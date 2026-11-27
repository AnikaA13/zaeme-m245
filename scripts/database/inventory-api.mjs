import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createInterface } from 'node:readline';
import { setTimeout as delay } from 'node:timers/promises';
import { randomUUID } from 'node:crypto';
import { container, sql } from './local.mjs';
import { operationId as op } from './fixtures.mjs';

// Beide HTTP-Anfragen müssen in unabhängigen Datenbanksitzungen nachweislich
// auf die Sperre warten. Erst danach darf eine davon die Transaktion beenden.
async function race(h, first, second) {
  const locker = spawn('docker', [
    'exec',
    '-i',
    container,
    'psql',
    '-XqAt',
    '-U',
    'postgres',
    '-v',
    'ON_ERROR_STOP=1',
  ]);
  const lines = createInterface({ input: locker.stdout });
  const exited = once(locker, 'exit');
  let calls = [];
  try {
    const ready = once(lines, 'line');
    locker.stdin.write(
      "begin; select pg_backend_pid() from public.households where id='" +
        h +
        "' for update;\n",
    );
    const [pid] = await Promise.race([
      ready,
      exited.then(() => {
        throw new Error('Sperrsitzung vorzeitig beendet');
      }),
    ]);
    assert.match(pid, /^\d+$/);
    calls = [first(), second()];
    // Auch indirektes Warten hinter dem zweiten Tupelsperrer zählt zur Kette.
    const waiting = `with recursive blocked(pid) as (
      select ${pid}::int union select a.pid from pg_stat_activity a join blocked b on b.pid=any(pg_blocking_pids(a.pid))
    ) select count(*) from blocked where pid<>${pid}`;
    let count = 0;
    for (let i = 0; i < 30 && count < 2; i++) {
      count = Number(sql(waiting));
      if (count < 2) await delay(50);
    }
    assert.ok(
      count >= 2,
      'Zwei Datenbanksitzungen warten auf dieselbe Haushaltszeile',
    );
    locker.stdin.end('commit;\n');
    assert.equal((await exited)[0], 0);
    return await Promise.all(calls);
  } finally {
    if (!locker.stdin.writableEnded) locker.stdin.end('rollback;\n');
    await exited;
    await Promise.allSettled(calls);
    lines.close();
  }
}

export function addInventoryCases({
  check,
  actors,
  rpc,
  request,
  rows,
  context,
  profiled,
  success,
  error,
  guest,
}) {
  const call = (u, ctx, name, args) =>
    rpc(u, name, { op: op(), ...ctx, ...args });
  const create = (u, ctx, fields, ack = false) =>
    call(u, ctx, 'create_item', { fields, ack });
  const reserve = (u, ctx, id, desired, v) =>
    call(u, ctx, 'set_reservation', { id, desired, v });
  const consume = (
    u,
    ctx,
    id,
    amount,
    confirm_full = false,
    unit = 'Stück',
    confirmed_v,
  ) =>
    call(u, ctx, 'consume_item', {
      id,
      amount,
      unit,
      confirm_full,
      confirmed_v,
    });
  const item = async (u, id) =>
    (await rows(u, 'inventory_items', '&id=eq.' + id))[0];
  const holds = (u, id) =>
    rows(u, 'reservations', '&inventory_item_id=eq.' + id);
  const fields = (changes = {}) => ({
    name: 'Birnen',
    quantity: '5',
    unit: 'Stück',
    category: 'Sonstiges',
    location: null,
    expiry_date: null,
    date_type: null,
    barcode: null,
    ...changes,
  });

  const balance = async (u, id) =>
    (await rows(u, 'active_inventory', '&id=eq.' + id))[0];
  async function quantities(u, id, expected) {
    const row = await balance(u, id);
    assert.deepEqual(
      [
        row.quantity,
        row.reserved_quantity,
        row.own_quantity,
        row.free_quantity,
        row.consumable_quantity,
        row.version,
      ],
      expected,
    );
  }

  check(
    'TT03/13/14 · Gemeinsame Chargen und konsistente persönliche Mengen',
    async () => {
      const { a, b, c, d, ac, bc } = actors();
      const milk = fields({
        name: 'Milch',
        quantity: '3',
        expiry_date: '2024-02-29',
        date_type: 'MHD',
      });
      const { id } = success(await create(a, ac, milk));
      const next = success(
        await create(a, ac, { ...milk, expiry_date: '2024-03-01' }),
      );
      assert.notEqual(next.id, id);
      const original = await item(b, id);
      assert.deepEqual(await item(c, id), original);
      assert.deepEqual(
        [
          original.name,
          original.quantity,
          original.expiry_date,
          original.version,
        ],
        ['Milch', 3, '2024-02-29', 1],
      );
      assert.equal(await balance(d, id), undefined);
      assert.equal(await item(d, id), undefined);
      let args = {
        op: op(),
        ...bc,
        id,
        fields: {
          ...milk,
          quantity: '5',
          name: 'Vollmilch',
          expiry_date: '2024-03-02',
        },
        v: 1,
        ack: false,
      };
      const changed = success(await rpc(b, 'edit_item', args));
      assert.deepEqual(await rpc(b, 'edit_item', args), changed);
      error(await rpc(b, 'edit_item', { ...args, op: op() }), 'STALE');
      const updated = await item(c, id);
      assert.deepEqual(
        [updated.name, updated.quantity, updated.expiry_date, updated.version],
        ['Vollmilch', 5, '2024-03-02', 2],
      );
      args = { op: op(), ...ac, id, desired: '2', v: 2 };
      const r = success(await rpc(a, 'set_reservation', args));
      assert.deepEqual(await rpc(a, 'set_reservation', args), r);
      success(await reserve(b, bc, id, '1', 3));
      await quantities(a, id, [5, 3, 2, 2, 4, 4]);
      await quantities(b, id, [5, 3, 1, 2, 3, 4]);
      success(await consume(a, ac, id, '3'));
      await quantities(a, id, [2, 1, 0, 1, 1, 5]);
      assert.deepEqual(
        (await holds(c, id)).map((r) => [r.user_id, r.quantity]),
        [[b.id, 1]],
      );
      const { id: lot } = success(
        await create(a, ac, { name: 'Brot', quantity: '3' }),
      );
      success(await reserve(a, ac, lot, '2', 1));
      for (const actor of [b, c]) {
        await quantities(actor, lot, [3, 2, 0, 1, 1, 2]);
        assert.equal((await holds(actor, lot))[0].user_id, a.id);
      }
      success(await consume(a, ac, lot, '1'));
      await quantities(a, lot, [2, 1, 1, 1, 2, 3]);
      const before = await item(a, lot);
      success(await reserve(b, bc, lot, '0', 3));
      assert.deepEqual(await item(a, lot), before);
      success(await consume(a, ac, lot, '2', true, 'Stück', 3));
      assert.equal(await balance(b, lot), undefined);
      assert.deepEqual(await holds(b, lot), []);
    },
  );

  check(
    'TT04/15/17 · Parallele Doppelaufträge, additive Abzüge und absolute Bearbeitungen',
    async () => {
      const { a, b, ac, bc } = actors();
      const name = randomUUID();
      const args = {
        op: op(),
        ...ac,
        fields: { name, quantity: '6' },
        ack: false,
      };
      const [one, two] = await race(
        ac.h,
        () => rpc(a, 'create_item', args),
        () => rpc(a, 'create_item', args),
      );
      const { id } = success(one);
      assert.deepEqual(two, one);
      assert.equal(
        (await rows(a, 'inventory_items', '&name=eq.' + name)).length,
        1,
      );
      const take = {
        op: op(),
        ...ac,
        id,
        amount: '1',
        confirm_full: false,
        unit: 'Stück',
      };
      const [x, y] = await race(
        ac.h,
        () => rpc(a, 'consume_item', take),
        () => rpc(a, 'consume_item', take),
      );
      assert.deepEqual(success(x), y);
      await quantities(a, id, [5, 0, 0, 5, 5, 2]);
      error(
        await rpc(a, 'set_reservation', {
          op: take.op,
          ...ac,
          id,
          desired: '1',
          v: 2,
        }),
        'OP_MISMATCH',
      );
      error(
        await rpc(a, 'consume_item', { ...take, id: randomUUID() }),
        'OP_MISMATCH',
      );
      for (const r of await race(
        ac.h,
        () => consume(a, ac, id, '1'),
        () => consume(b, bc, id, '1'),
      ))
        success(r);
      await quantities(a, id, [3, 0, 0, 3, 3, 4]);
      const edit = (u, ctx, quantity) =>
        call(u, ctx, 'edit_item', {
          id,
          v: 4,
          fields: fields({ quantity }),
          ack: false,
        });
      const edits = await race(
        ac.h,
        () => edit(a, ac, '4'),
        () => edit(b, bc, '5'),
      );
      assert.equal(edits.filter((r) => r.ok).length, 1);
      error(
        edits.find((r) => !r.ok),
        'STALE',
      );
      const q = edits[0].ok ? 4 : 5;
      await quantities(a, id, [q, 0, 0, q, q, 5]);
    },
  );

  check(
    'TT15/16 · Reservierung gegen Verbrauch, Einheitenwechsel und Löschung',
    async () => {
      const { a, b, ac, bc } = actors();
      for (const action of ['consume_item', 'edit_item', 'delete_item']) {
        const { id } = success(
          await create(a, ac, { name: 'Charge', quantity: '3' }),
        );
        const params = {
          consume_item: { amount: '2', unit: 'Stück', confirm_full: false },
          edit_item: {
            fields: fields({ quantity: '1', unit: 'Liter' }),
            v: 1,
            ack: false,
          },
          delete_item: { v: 1, confirm: true },
        }[action];
        const [hold, mutation] = await race(
          ac.h,
          () => reserve(b, bc, id, '2', 1),
          () => call(a, ac, action, { id, ...params }),
        );
        assert.equal([hold, mutation].filter((r) => r.ok).length, 1);
        if (hold.ok) {
          error(mutation, action === 'consume_item' ? 'INSUFFICIENT' : 'STALE');
          await quantities(a, id, [3, 2, 0, 1, 1, 2]);
        } else if (action === 'delete_item') {
          error(hold, 'NOT_FOUND');
          assert.equal(await item(a, id), undefined);
          assert.deepEqual(await holds(a, id), []);
        } else {
          error(hold, 'STALE');
          await quantities(a, id, [1, 0, 0, 1, 1, 2]);
          assert.equal(
            (await item(a, id)).unit,
            action === 'edit_item' ? 'Liter' : 'Stück',
          );
        }
      }
    },
  );

  check(
    'TT11 · Bestätigung gilt nur für den tatsächlich angezeigten Stand',
    async () => {
      const { a, b, ac, bc } = actors();
      const { id } = success(await create(a, ac, fields({ quantity: '2' })));
      const observed = await item(a, id);
      success(
        await call(b, bc, 'edit_item', {
          id,
          fields: fields({ name: 'Andere Packung', quantity: '2' }),
          v: 1,
          ack: false,
        }),
      );
      const [late, valid] = await race(
        ac.h,
        () =>
          consume(
            a,
            ac,
            id,
            String(observed.quantity),
            true,
            observed.unit,
            observed.version,
          ),
        () => consume(b, bc, id, '1'),
      );
      error(late, 'STALE');
      success(valid);
      await quantities(a, id, [1, 0, 0, 1, 1, 3]);
    },
  );

  check(
    'TT12/16 · Austritt gegen Reservierung und Entfernung gegen Verbrauch oder Freigabe',
    async () => {
      const { a, ac, link } = actors();
      const member = await profiled('wechsel');
      for (const change of ['reserve', 'consume', 'release']) {
        success(
          await rpc(member, 'join_household', { op: op(), token: link.token }),
        );
        const ctx = await context(member);
        const { id } = success(await create(a, ac, fields()));
        const other = success(await create(a, ac, fields())).id;
        success(await reserve(a, ac, id, '1', 1));
        success(await reserve(member, ctx, id, '2', 2));
        success(await reserve(member, ctx, other, '1', 1));
        const depart = () =>
          change === 'reserve'
            ? call(member, ctx, 'leave_household', { confirm: true })
            : call(a, ac, 'remove_member', {
                target: member.id,
                target_g: ctx.g,
              });
        const mutate = () =>
          change === 'consume'
            ? consume(member, ctx, id, '1')
            : reserve(member, ctx, id, change === 'release' ? '0' : '3', 3);
        const [gone, late] = await race(ac.h, depart, mutate);
        success(gone);
        if (!late.ok) error(late, 'FORBIDDEN');
        const q = change === 'consume' && late.ok ? 4 : 5;
        const version = late.ok && change !== 'release' ? 5 : 4;
        await quantities(a, id, [q, 1, 1, q - 1, q, version]);
        await quantities(a, other, [5, 0, 0, 5, 5, 3]);
        assert.deepEqual(
          (await holds(a, id)).map((r) => r.user_id),
          [a.id],
        );
        assert.equal(await balance(member, id), undefined);
        error(await reserve(member, ctx, id, '1', version), 'FORBIDDEN');
      }
    },
  );

  check('F02 · Auflösung mit reserviertem Vorrat', async () => {
    const owner = await profiled('aufloesung');
    success(
      await rpc(owner, 'create_household', {
        op: op(),
        name: 'Einpersonenhaushalt',
      }),
    );
    const ctx = await context(owner);
    const { id } = success(await create(owner, ctx, { name: 'Vorrat' }));
    success(await reserve(owner, ctx, id, '1', 1));
    success(await call(owner, ctx, 'dissolve_household', { confirm: true }));
    assert.equal(
      sql(
        "select (select count(*) from public.inventory_items where id='" +
          id +
          "')+(select count(*) from public.reservations where inventory_item_id='" +
          id +
          "')",
      ),
      '0',
    );
    assert.equal((await rows(owner, 'profiles'))[0].id, owner.id);
  });

  check(
    'F10 · Geteilte Grenzwerte, Kategoriepaare und datumsgebundene Bestätigung',
    async () => {
      const { a, ac } = actors();
      const fixtures = JSON.parse(
        readFileSync(
          new URL('../../fixtures/inventory-validation.json', import.meta.url),
          'utf8',
        ),
      );
      for (const sample of fixtures.items) {
        const r = await create(a, ac, { name: 'Testcharge', ...sample.fields });
        assert.equal(r.ok, sample.valid, sample.label + ' / ' + r.code);
        if (!sample.valid) error(r, 'INVALID');
        if (sample.fields.barcode === '0123456789012') {
          const saved = await item(a, r.id);
          assert.equal(saved.barcode, sample.fields.barcode);
          assert.equal(saved.expiry_date, null);
          assert.equal(saved.date_type, null);
        }
      }
      for (const category of [
        'Früchte/Gemüse',
        'Fleisch/Fisch',
        'Brot/Backwaren',
        'Trockenwaren',
        'Getränke',
        'Milchprodukte',
        'Sonstiges',
      ]) {
        for (const unit of ['Stück', 'Packung', 'kg', 'Liter']) {
          const permitted =
            ['Stück', 'Packung'].includes(unit) ||
            ['Milchprodukte', 'Sonstiges'].includes(category) ||
            (category === 'Getränke' ? unit === 'Liter' : unit === 'kg');
          assert.equal(
            (await create(a, ac, { name: 'Charge', category, unit })).ok,
            permitted,
            category + ' / ' + unit,
          );
        }
      }
      for (const bad of [
        null,
        [],
        true,
        { name: 'A', unit: 'ml' },
        { name: 'A', category: 'Andere' },
      ])
        error(await create(a, ac, bad), 'INVALID');
      const date = (years, days) =>
        sql(
          "select (((now() at time zone 'Europe/Zurich')::date + interval '" +
            years +
            " years')::date + " +
            days +
            ')::text',
        );
      const dated = (expiry_date) =>
        fields({ expiry_date, date_type: 'unbekannt' });
      for (const f of fixtures.expiry) {
        const result = await create(a, ac, dated(date(f.years, f.days)), f.ack);
        if (f.code) error(result, f.code);
        else success(result);
      }
      for (const f of fixtures.reservations) {
        const { id } = success(
          await create(a, ac, {
            name: 'Grenzmenge',
            unit: f.unit,
            quantity: f.stock,
          }),
        );
        const result = await reserve(a, ac, id, f.desired, 1);
        if (f.code) error(result, f.code);
        else success(result);
      }
      const far = dated(date(5, 1));
      error(await create(a, ac, far), 'DATE_ACK');
      error(await create(a, ac, far, 'true'), 'INVALID');
      const args = { op: op(), ...ac, fields: far, ack: true };
      const saved = success(await rpc(a, 'create_item', args));
      error(
        await rpc(a, 'create_item', { ...args, fields: dated(date(20, 0)) }),
        'OP_MISMATCH',
      );
      success(
        await call(a, ac, 'edit_item', {
          id: saved.id,
          fields: { ...far, name: 'Neue Beschriftung' },
          v: 1,
          ack: false,
        }),
      );
      error(
        await call(a, ac, 'edit_item', {
          id: saved.id,
          fields: dated(date(20, 0)),
          v: 2,
          ack: false,
        }),
        'DATE_ACK',
      );
      success(await create(a, ac, dated(date(20, 0)), true));
      error(await create(a, ac, dated(date(20, 1)), true), 'INVALID');
    },
  );

  check(
    'F03/F07/F17 · Exakte Teilmengen, eigene Freigabe, Versionen und Wiederholungen',
    async () => {
      const { a, b, ac, bc } = actors();
      const base = fields({ name: ' Mehl ', unit: 'kg', quantity: '01.500' });
      const args = { op: op(), ...ac, fields: base, ack: false };
      const receipt = success(await rpc(a, 'create_item', args));
      const id = receipt.id;
      assert.deepEqual(
        await rpc(a, 'create_item', {
          ...args,
          fields: { ...base, name: 'Mehl', quantity: '1.5' },
        }),
        receipt,
      );
      assert.notEqual(success(await create(a, ac, base)).id, id);
      const edit = (f, v) =>
        call(a, ac, 'edit_item', { id, fields: f, v, ack: false });
      const del = (v, confirm) =>
        call(a, ac, 'delete_item', { id, v, confirm });
      error(await edit({ name: 'Mehl' }, 1), 'INVALID');
      success(await reserve(a, ac, id, '0.500', 1));
      success(await reserve(b, bc, id, '0.4', 2));
      error(await reserve(a, ac, id, '1.2', 3), 'INSUFFICIENT');
      error(await edit({ ...base, quantity: '0.899' }, 3), 'RESERVED');
      error(await edit({ ...base, category: 'Trockenwaren' }, 3), 'RESERVED');
      error(await edit({ ...base, unit: 'Liter' }, 3), 'RESERVED');
      error(await del(3, true), 'RESERVED');
      error(await consume(a, ac, id, '1.101', false, 'kg'), 'INSUFFICIENT');
      error(await consume(a, ac, id, '0.001', false, 'Stück'), 'STALE');
      for (const bad of [0.1, null, '0', '0.0001', '1e-1', '-Infinity']) {
        error(await consume(a, ac, id, bad, false, 'kg'), 'INVALID');
      }
      const take = {
        op: op(),
        ...ac,
        id,
        amount: '0.101',
        unit: 'kg',
        confirm_full: false,
      };
      const done = success(await rpc(a, 'consume_item', take));
      assert.deepEqual(await rpc(a, 'consume_item', take), done);
      error(
        await rpc(a, 'consume_item', { ...take, amount: '0.102' }),
        'OP_MISMATCH',
      );
      assert.equal((await item(b, id)).quantity, 1.399);
      assert.equal(
        (await holds(b, id)).find((r) => r.user_id === a.id).quantity,
        0.399,
      );
      success(await consume(a, ac, id, '0.599', false, 'kg'));
      assert.equal((await item(b, id)).quantity, 0.8);
      assert.deepEqual(
        (await holds(b, id)).map((r) => [r.user_id, r.quantity]),
        [[b.id, 0.4]],
      );
      error(await reserve(b, bc, id, '0', 4), 'STALE');
      success(await reserve(b, bc, id, '0.2', 5));
      success(await reserve(b, bc, id, '0', 6));
      assert.deepEqual(await holds(b, id), []);
      success(await edit({ ...base, quantity: '2', unit: 'Packung' }, 7));
      error(await consume(b, bc, id, '1', false, 'kg'), 'STALE');
      error(await del(7, true), 'STALE');
      error(await del(8, false), 'CONFIRM_REQUIRED');
      error(await del(8, 'yes'), 'INVALID');
      success(await del(8, true));
      assert.equal(await item(b, id), undefined);
      const old = op(Date.now() - 86401000);
      error(await rpc(a, 'create_item', { ...args, op: old }), 'OP_EXPIRED');
    },
  );

  check(
    'TT13/14/17 · Zwei wartende Reservierungen und konkurrierender Vollverbrauch',
    async () => {
      const { a, b, ac, bc } = actors();
      let { id } = success(await create(a, ac, fields({ quantity: '3' })));
      const attempts = await race(
        ac.h,
        () => reserve(a, ac, id, '2', 1),
        () => reserve(b, bc, id, '2', 1),
      );
      assert.equal(attempts.filter((r) => r.ok).length, 1);
      error(
        attempts.find((r) => !r.ok),
        'STALE',
      );
      const [owner] = await holds(a, id);
      const [other, ctx] = owner.user_id === a.id ? [b, bc] : [a, ac];
      error(await reserve(other, ctx, id, '2', 2), 'INSUFFICIENT');
      error(await consume(other, ctx, id, '2'), 'INSUFFICIENT');
      success(await consume(other, ctx, id, '1'));
      assert.equal((await item(a, id)).quantity, 2);
      assert.equal((await holds(a, id))[0].quantity, 2);
      id = success(await create(a, ac, fields({ quantity: '2' }))).id;
      const takes = await race(
        ac.h,
        () => consume(a, ac, id, '1'),
        () => consume(b, bc, id, '1'),
      );
      assert.equal(takes.filter((r) => r.ok).length, 1);
      error(
        takes.find((r) => !r.ok),
        'CONFIRM_FULL',
      );
      error(await consume(a, ac, id, '1', 'true'), 'INVALID');
      error(await consume(a, ac, id, '1', true), 'CONFIRM_FULL');
      error(await consume(a, ac, id, '1', true, 'Stück', 1), 'STALE');
      success(await consume(a, ac, id, '1', true, 'Stück', 2));
      const final = await item(b, id);
      assert.deepEqual(
        [final.quantity, final.status, final.version],
        [0, 'consumed', 3],
      );
      error(await reserve(a, ac, id, '1', 3), 'STALE');
      error(
        await call(a, ac, 'delete_item', { id, v: 3, confirm: true }),
        'STALE',
      );
    },
  );

  check(
    'TT02/12/16 · Zugriff, konkurrierende Entfernung, Austritt und alte Generation',
    async () => {
      const { a, b, d, e, ac, bc, dc, link } = actors();
      const person = await profiled('vorrat');
      const join = async () => {
        success(
          await rpc(person, 'join_household', { op: op(), token: link.token }),
        );
        return context(person);
      };
      const pc = await join();
      const { id } = success(await create(a, ac, fields()));
      const second = success(await create(a, ac, { name: 'Andere Charge' })).id;
      const reservation = { op: op(), ...pc, id, desired: '2', v: 1 };
      success(await rpc(person, 'set_reservation', reservation));
      success(await reserve(person, pc, second, '1', 1));
      const targets = [
        ['create_item', { fields: fields(), ack: false }],
        ['edit_item', { id, fields: fields(), v: 2, ack: false }],
        ['set_reservation', { id, desired: '1', v: 2 }],
        [
          'consume_item',
          { id, amount: '1', unit: 'Stück', confirm_full: true },
        ],
        ['delete_item', { id, v: 2, confirm: true }],
      ];
      for (const [name, params] of targets) {
        const body = { op: op(), ...ac, ...params };
        assert.ok(
          [401, 403, 404].includes(
            (await request('/rest/v1/rpc/' + name, guest, 'POST', body)).status,
          ),
        );
        error(await rpc(d, name, body), 'FORBIDDEN');
        error(await rpc(e, name, body), 'FORBIDDEN');
        error(await rpc(a, name, { ...body, g: randomUUID() }), 'FORBIDDEN');
        error(await rpc(a, name, { ...body, h: dc.h }), 'FORBIDDEN');
        if (name !== 'create_item')
          error(await rpc(d, name, { ...body, ...dc }), 'NOT_FOUND');
      }
      for (const [actor, ctx] of [
        [a, ac],
        [b, bc],
      ]) {
        assert.equal(
          (
            await request('/rest/v1/rpc/set_reservation', actor.jwt, 'POST', {
              ...reservation,
              ...ctx,
              user_id: person.id,
            })
          ).status,
          404,
        );
        error(
          await consume(actor, ctx, id, '5', true, 'Stück', 2),
          'INSUFFICIENT',
        );
      }
      for (const key of [
        'household_id',
        'created_by',
        'status',
        'version',
        'created_at',
        'updated_at',
        'reserved_quantity',
        'user_id',
      ]) {
        error(
          await create(a, ac, { name: 'Unerlaubtes Feld', [key]: a.id }),
          'INVALID',
        );
      }
      assert.equal(
        (
          await request('/rest/v1/rpc/lock_item', a.jwt, 'POST', {
            h: ac.h,
            item_id: id,
          })
        ).status,
        404,
      );
      assert.equal(
        sql(
          "select quantity from public.reservations where inventory_item_id='" +
            id +
            "' and user_id='" +
            person.id +
            "'",
        ),
        '2',
      );
      for (const [name, key, record] of [
        ['inventory_items', 'id', { name: 'Fremd' }],
        ['reservations', 'inventory_item_id', { quantity: 3 }],
      ]) {
        const path = '/rest/v1/' + name + '?' + key + '=eq.' + id;
        assert.ok(
          [401, 403, 404].includes((await request(path, guest)).status),
        );
        for (const u of [d, e])
          assert.deepEqual((await request(path, u.jwt)).body, []);
        for (const method of ['POST', 'PATCH', 'DELETE']) {
          assert.ok(
            [401, 403, 404].includes(
              (
                await request(
                  path,
                  a.jwt,
                  method,
                  method === 'DELETE' ? undefined : record,
                )
              ).status,
            ),
          );
        }
      }
      const [change, remove] = await race(
        ac.h,
        () => reserve(person, pc, id, '3', 2),
        () =>
          call(a, ac, 'remove_member', { target: person.id, target_g: pc.g }),
      );
      success(remove);
      if (!change.ok) error(change, 'FORBIDDEN');
      assert.deepEqual(await holds(a, id), []);
      assert.equal((await item(a, id)).version, change.ok ? 4 : 3);
      assert.equal((await item(a, second)).version, 3);
      assert.equal(await item(person, id), undefined);
      assert.deepEqual(await holds(person, id), []);
      error(await rpc(person, 'set_reservation', reservation), 'FORBIDDEN');
      const next = await join();
      assert.notEqual(next.g, pc.g);
      error(await rpc(person, 'set_reservation', reservation), 'FORBIDDEN');
      error(
        await rpc(person, 'set_reservation', { ...reservation, op: op() }),
        'FORBIDDEN',
      );
      const v = (await item(a, id)).version;
      success(await reserve(person, next, id, '1', v));
      success(await call(person, next, 'leave_household', { confirm: true }));
      assert.deepEqual(await holds(a, id), []);
      assert.equal((await item(a, id)).version, v + 2);
      error(
        await call(a, ac, 'delete_item', {
          id: randomUUID(),
          v: 1,
          confirm: true,
        }),
        'NOT_FOUND',
      );
    },
  );
}
