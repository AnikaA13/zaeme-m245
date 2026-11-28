import assert from 'node:assert/strict';
import { test } from 'node:test';
import { apiFixture } from './api-fixture.mjs';
import { race } from './inventory-api.mjs';
import { operationId as op } from './fixtures.mjs';

test('Einkauf und transaktionale Signale über PostgREST', async (t) => {
  const {
    profiled,
    rpc,
    rows,
    context,
    makeInvite,
    success,
    error,
    guest,
    request,
  } = apiFixture(t);
  const [a, b, c, d, e] = await Promise.all(
    ['owner', 'zwei', 'drei', 'fremd', 'frei'].map(profiled),
  );
  const call = (user, ctx, action, args) =>
    rpc(user, action, { op: op(), ...ctx, ...args });
  for (const user of [a, d])
    success(await call(user, {}, 'create_household', { name: 'Test' }));
  const ac = await context(a),
    dc = await context(d);
  const revision = async () => (await rows(a, 'household_signals'))[0].revision;
  const signed = async (delta, fn) => {
    const before = await revision();
    const result = await fn();
    assert.equal(await revision(), before + delta);
    return result;
  };
  const invite = await signed(0, () => makeInvite(a, ac));
  for (const member of [b, c])
    success(
      await signed(1, () =>
        call(member, {}, 'join_household', { token: invite.token }),
      ),
    );
  const bc = await context(b),
    cc = await context(c);
  const fields = { name: 'Birnen', quantity: '1.125', unit: 'kg' };
  let id;
  await t.test(
    'Mengenpaar, Präzision, Unicode und geschützte Felder',
    async () => {
      for (const invalid of [
        null,
        [],
        {},
        { name: 12 },
        { name: '\u00a0' },
        { name: '🍐'.repeat(101) },
        { name: 'A', quantity: '2' },
        { name: 'A', unit: 'kg' },
        { ...fields, quantity: 1 },
        { ...fields, quantity: 'NaN' },
        { ...fields, quantity: 'Infinity' },
        { ...fields, quantity: '9999.001' },
        { ...fields, quantity: '1.0000' },
        { ...fields, quantity: '0' },
        { ...fields, quantity: '1e2' },
        { ...fields, unit: 'Packung' },
        { ...fields, unit: 'Stück' },
        { ...fields, unit: 'g' },
        { ...fields, quantity: null },
        { ...fields, unit: null },
        ...[
          'checked',
          'version',
          'category',
          'household_id',
          'updated_at',
          'id',
        ].map((key) => ({ ...fields, [key]: true })),
      ]) {
        error(
          await signed(0, () =>
            call(a, ac, 'create_shopping', { fields: invalid }),
          ),
          'INVALID',
        );
      }
      for (const valid of [
        { name: '🍐'.repeat(100) },
        { ...fields, quantity: '9999', unit: 'Packung' },
        { ...fields, quantity: '0.001', unit: 'Liter' },
        { name: 'Reis', unit: null, quantity: null },
      ]) {
        const row = success(
          await call(b, bc, 'create_shopping', { fields: valid }),
        );
        success(await call(b, bc, 'delete_shopping', { id: row.id, v: 1 }));
      }
    },
  );
  await t.test(
    'Drei Mitglieder, Quittungen, fremde Haushalte und Tabellenrechte',
    async () => {
      const create = {
        op: op(),
        ...ac,
        fields: { ...fields, name: '  Birnen\u00a0' },
      };
      const first = success(
        await signed(1, () => rpc(a, 'create_shopping', create)),
      );
      id = first.id;
      assert.deepEqual(
        await signed(0, () => rpc(a, 'create_shopping', create)),
        first,
      );
      error(
        await signed(0, () =>
          rpc(a, 'create_shopping', { ...create, fields: { name: 'Brot' } }),
        ),
        'OP_MISMATCH',
      );
      for (const user of [a, b, c]) {
        const [item] = await rows(user, 'shopping_items');
        assert.deepEqual(
          [
            item.id,
            item.name,
            item.checked,
            item.quantity,
            item.unit,
            item.version,
          ],
          [id, 'Birnen', false, 1.125, 'kg', 1],
        );
      }
      const same = success(
        await signed(1, () => call(c, cc, 'create_shopping', { fields })),
      );
      assert.notEqual(same.id, id);
      const edit = {
        op: op(),
        ...bc,
        id: same.id,
        v: 1,
        fields: { name: 'Birnen', quantity: null, unit: null },
      };
      const edited = success(
        await signed(1, () => rpc(b, 'edit_shopping', edit)),
      );
      assert.equal(edited.version, 2);
      assert.deepEqual(
        await signed(0, () => rpc(b, 'edit_shopping', edit)),
        edited,
      );
      const [cleared] = await rows(c, 'shopping_items', '&id=eq.' + same.id);
      assert.deepEqual([cleared.quantity, cleared.unit], [null, null]);
      assert.deepEqual(
        await signed(0, () =>
          rpc(b, 'edit_shopping', { ...edit, op: op(), v: 2 }),
        ),
        edited,
      );
      const remove = { op: op(), ...ac, id: same.id, v: 2 };
      const removed = success(
        await signed(1, () => rpc(a, 'delete_shopping', remove)),
      );
      assert.deepEqual(
        await signed(0, () => rpc(a, 'delete_shopping', remove)),
        removed,
      );
      for (const user of [d, e])
        assert.deepEqual(await rows(user, 'shopping_items'), []);
      error(await call(d, dc, 'delete_shopping', { id, v: 1 }), 'NOT_FOUND');
      error(await call(d, ac, 'delete_shopping', { id, v: 1 }), 'FORBIDDEN');
      for (const [table, body] of [
        ['shopping_items', { name: 'Test', household_id: ac.h }],
        ['household_signals', { id: ac.h, revision: 88 }],
      ]) {
        assert.ok(
          [401, 403].includes(
            (await request('/rest/v1/' + table, guest)).status,
          ),
        );
        for (const method of ['POST', 'PATCH', 'DELETE']) {
          const response = await request(
            '/rest/v1/' +
              table +
              '?id=eq.' +
              (table === 'shopping_items' ? id : ac.h),
            a.jwt,
            method,
            method === 'DELETE' ? undefined : body,
          );
          assert.equal(response.status, 403);
        }
      }
    },
  );
  await t.test(
    'Abhaken und Wiederöffnen mit Bestand als unabhängige Kontrolle',
    async () => {
      success(
        await call(a, ac, 'create_item', {
          fields: { name: 'Birnen' },
          ack: false,
        }),
      );
      const before = await rows(c, 'inventory_items');
      for (const [checked, v] of [
        [true, 1],
        [false, 2],
      ]) {
        const args = { op: op(), ...bc, id, v, checked };
        const first = success(
          await signed(1, () => rpc(b, 'check_shopping', args)),
        );
        assert.equal(first.version, v + 1);
        assert.deepEqual(
          await signed(0, () => rpc(b, 'check_shopping', args)),
          first,
        );
        success(
          await signed(0, () =>
            call(b, bc, 'check_shopping', { id, v: v + 1, checked }),
          ),
        );
        assert.equal((await rows(c, 'shopping_items'))[0].checked, checked);
        assert.deepEqual(await rows(c, 'inventory_items'), before);
      }
      error(
        await signed(0, () =>
          call(b, bc, 'check_shopping', { id, v: 3, checked: 'true' }),
        ),
        'INVALID',
      );
      error(
        await signed(0, () =>
          call(b, bc, 'edit_shopping', { id, v: 3, fields: { name: 'Fehlt' } }),
        ),
        'INVALID',
      );
      error(
        await signed(0, () =>
          call(b, bc, 'check_shopping', { id, v: 1, checked: true }),
        ),
        'STALE',
      );
    },
  );
  await t.test(
    'Unabhängige Datenbanksitzungen für Änderung, Markierung und Löschung',
    async () => {
      const edits = await signed(1, () =>
        race(
          ac.h,
          () =>
            call(a, ac, 'edit_shopping', {
              id,
              v: 3,
              fields: { ...fields, name: 'A' },
            }),
          () =>
            call(b, bc, 'edit_shopping', {
              id,
              v: 3,
              fields: { ...fields, name: 'B' },
            }),
        ),
      );
      assert.equal(edits.filter((x) => x.ok).length, 1);
      error(
        edits.find((x) => !x.ok),
        'STALE',
      );
      const checks = await signed(1, () =>
        race(
          ac.h,
          () => call(a, ac, 'check_shopping', { id, v: 4, checked: true }),
          () => call(b, bc, 'check_shopping', { id, v: 4, checked: false }),
        ),
      );
      assert.ok(checks.every((x) => x.ok || x.code === 'STALE'));
      assert.equal((await rows(c, 'shopping_items'))[0].checked, true);
      const deletes = await signed(1, () =>
        race(
          ac.h,
          () => call(a, ac, 'delete_shopping', { id, v: 5 }),
          () => call(b, bc, 'delete_shopping', { id, v: 5 }),
        ),
      );
      assert.equal(deletes.filter((x) => x.ok).length, 1);
      error(
        deletes.find((x) => !x.ok),
        'NOT_FOUND',
      );
      const distinct = await signed(2, () =>
        race(
          ac.h,
          () => call(a, ac, 'create_shopping', { fields }),
          () => call(c, cc, 'create_shopping', { fields }),
        ),
      );
      distinct.forEach(success);
    },
  );
  await t.test(
    'Profil, Warnfrist, Vorrat, Reservierung und Mitgliedschaft',
    async () => {
      const args = { op: op(), ...ac, v: 1, days: 0 };
      success(await signed(1, () => rpc(a, 'set_warning_days', args)));
      success(await signed(0, () => rpc(a, 'set_warning_days', args)));
      for (const [user, ctx, days, v, code] of [
        [a, ac, 3, 1, 'STALE'],
        [b, bc, 30, 2, 'FORBIDDEN'],
        [a, ac, 30.1, 2, 'INVALID'],
      ]) {
        error(
          await signed(0, () =>
            call(user, ctx, 'set_warning_days', { days, v }),
          ),
          code,
        );
      }
      success(
        await signed(1, () =>
          call(a, ac, 'set_warning_days', { v: 2, days: 30 }),
        ),
      );
      success(
        await signed(1, () =>
          call(b, bc, 'save_profile', { name: 'Neu', v: 1 }),
        ),
      );
      const stock = success(
        await signed(1, () =>
          call(a, ac, 'create_item', {
            fields: { name: 'Reis', quantity: '7' },
            ack: false,
          }),
        ),
      );
      const stockId = stock.id;
      const editFields = {
        name: 'Brot',
        quantity: '8',
        unit: 'Stück',
        category: 'Sonstiges',
        location: null,
        barcode: null,
        date_type: null,
        expiry_date: null,
      };
      success(
        await signed(1, () =>
          call(a, ac, 'edit_item', {
            id: stockId,
            v: 1,
            fields: editFields,
            ack: false,
          }),
        ),
      );
      for (const [v, desired, delta] of [
        [2, '1', 1],
        [3, '2', 1],
        [4, '2', 0],
        [4, '0', 1],
      ]) {
        success(
          await signed(delta, () =>
            call(b, bc, 'set_reservation', { id: stockId, v, desired }),
          ),
        );
      }
      success(
        await signed(1, () =>
          call(b, bc, 'consume_item', {
            id: stockId,
            amount: '2',
            unit: 'Stück',
            confirm_full: false,
          }),
        ),
      );
      success(
        await signed(1, () =>
          call(a, ac, 'delete_item', { id: stockId, v: 6, confirm: true }),
        ),
      );
      success(
        await signed(1, () =>
          call(a, ac, 'remove_member', { target: b.id, target_g: bc.g }),
        ),
      );
      for (const table of ['shopping_items', 'household_signals'])
        assert.deepEqual(await rows(b, table), []);
      error(await call(b, bc, 'create_shopping', { fields }), 'FORBIDDEN');
      success(
        await signed(1, () =>
          call(c, cc, 'leave_household', { confirm: true }),
        ),
      );
      success(await call(a, ac, 'dissolve_household', { confirm: true }));
      assert.deepEqual(await rows(a, 'household_signals'), []);
      assert.deepEqual(await rows(a, 'shopping_items'), []);
    },
  );
});
