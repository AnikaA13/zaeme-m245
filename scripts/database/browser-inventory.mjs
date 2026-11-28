import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { mkdir, writeFile } from 'node:fs/promises';
import { api, sql } from './local.mjs';
import { operationId } from './fixtures.mjs';

async function actor(page) {
  return page.evaluate(async () => {
    const { activeScope } = await import('/src/features/auth/session.ts');
    const { user, household: h, generation: g, jwt } = activeScope();
    return { user, h, g, jwt };
  });
}

export async function write(page, name, args) {
  return page.evaluate(
    async ({ name, args }) => {
      const { mutate } = await import('/src/lib/operations/rpc.ts');
      const { activeScope } = await import('/src/features/auth/session.ts');
      const { household: h, generation: g } = activeScope();
      return mutate(name, { h, g, ...args });
    },
    { name, args },
  );
}

// Datenbankzustand unabhängig von Browser, PostgREST und RPC-Quittung lesen.
function stock(id) {
  assert.match(id, /^[a-f0-9-]{36}$/);
  return JSON.parse(
    sql(`select coalesce((select jsonb_build_object(
    'quantity', i.quantity, 'version', i.version, 'reservations',
    (select coalesce(jsonb_object_agg(user_id,quantity),'{}'::jsonb)
       from public.reservations where inventory_item_id=i.id))
    from public.inventory_items i where i.id='${id}'),'null'::jsonb)`),
  );
}

export async function householdInventory({
  a,
  b,
  c,
  invitation,
  join,
  confirm,
  heading,
  step,
  publicKey,
}) {
  const owner = await actor(a),
    bea = await actor(b),
    cora = await actor(c);
  async function rest(person, path, body) {
    const response = await fetch(api + '/rest/v1/' + path, {
      method: body ? 'POST' : 'GET',
      headers: {
        apikey: publicKey,
        Authorization: 'Bearer ' + person.jwt,
        'Content-Type': 'application/json',
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    assert.equal(response.status, 200);
    return response.json();
  }
  async function denied(person, id) {
    assert.deepEqual(
      await rest(
        person,
        'active_inventory?select=id&household_id=eq.' + person.h,
      ),
      [],
    );
    assert.equal(
      (
        await rest(person, 'rpc/consume_item', {
          op: operationId(),
          h: person.h,
          g: person.g,
          id,
          amount: '1',
          unit: 'Stück',
          confirm_full: false,
        })
      ).code,
      'FORBIDDEN',
    );
  }
  const items = [];
  async function reserve(p, id, desired) {
    return write(p, 'set_reservation', { id, desired, v: stock(id).version });
  }
  await step('Integration A – Austritt mit Reservierung', async () => {
    for (const name of ['Äpfel', 'Birnen']) {
      const r = await write(a, 'create_item', {
        fields: { name, quantity: '12' },
        ack: false,
      });
      assert.equal(r.version, 1);
      items.push(r.id);
    }
    await reserve(b, items[0], '2');
    const before = stock(items[0]);
    assert.deepEqual(before.reservations, { [bea.user]: 2 });
    await confirm(b, 'Haushalt verlassen');
    await heading(b, 'Dein Haushalt');
    assert.deepEqual(stock(items[0]), {
      quantity: 12,
      version: before.version + 1,
      reservations: {},
    });
    await denied(bea, items[0]);
    await b.goto(invitation);
    await join(b);
  });
  const original = {
    op: operationId(),
    h: cora.h,
    g: cora.g,
    id: items[0],
    desired: '3',
    v: stock(items[0]).version,
  };
  await step(
    'Integration B – Entfernung mit mehreren Reservierungen',
    async () => {
      assert.equal(
        (await rest(cora, 'rpc/set_reservation', original)).ok,
        true,
      );
      await reserve(c, items[1], '4');
      await reserve(a, items[0], '1');
      await reserve(b, items[1], '2');
      const before = items.map(stock);
      assert.deepEqual(
        before.map((x) => x.reservations[cora.user]),
        [3, 4],
      );
      const page = await rest(
        owner,
        'active_inventory?select=id,reserved_quantity,own_quantity,free_quantity,consumable_quantity&order=created_at,id&limit=1',
      );
      assert.deepEqual(page, [
        {
          id: items[0],
          reserved_quantity: 4,
          own_quantity: 1,
          free_quantity: 8,
          consumable_quantity: 9,
        },
      ]);
      await c.goto(new URL('/inventory/' + items[1], c.url()).href);
      await heading(c, 'Birnen');
      const removed = a
        .waitForResponse(
          (r) =>
            r.url().endsWith('/rpc/remove_member') &&
            r.request().method() === 'POST',
        )
        .then(async (r) => {
          const stamp = performance.now();
          assert.equal((await r.json()).ok, true);
          return stamp;
        });
      const detected = heading(c, 'Dein Haushalt').then(() =>
        performance.now(),
      );
      await confirm(a, 'Cora entfernen');
      const elapsed = Math.ceil((await detected) - (await removed));
      assert.ok(
        elapsed >= 0 && elapsed <= 3000,
        'Entzug nach ' + elapsed + ' ms',
      );
      const dir =
        process.env.ZAEME_009B_REVIEW === '1'
          ? 'docs/review/task009b'
          : 'test-results/task009b';
      await mkdir(dir, { recursive: true });
      await writeFile(
        dir + '/entzug.json',
        JSON.stringify({ aktion: 'Mitgliedschaftsentzug', ms: elapsed }) + '\n',
      );
      await a.getByText('Cora', { exact: true }).waitFor({ state: 'detached' });
      assert.deepEqual(
        items.map(stock),
        before.map((s, i) => ({
          quantity: 12,
          version: s.version + 1,
          reservations: i === 0 ? { [owner.user]: 1 } : { [bea.user]: 2 },
        })),
      );
      await denied(cora, items[1]);
      await heading(c, 'Dein Haushalt');
      assert.equal(await c.getByText('Birnen', { exact: true }).count(), 0);
      assert.equal(await c.getByText('WG A', { exact: true }).count(), 0);
      await c.waitForFunction(
        async () =>
          (await import('/src/lib/supabase/client.ts')).backend().getChannels()
            .length === 0,
      );
      assert.deepEqual(
        await rest(cora, 'household_signals?select=revision&id=eq.' + cora.h),
        [],
      );
      assert.deepEqual(
        await rest(cora, 'shopping_items?select=id&household_id=eq.' + cora.h),
        [],
      );
    },
  );
  await step(
    'Integration C – Wiederbeitritt mit neuer Generation',
    async () => {
      await c.goto(invitation);
      await join(c);
      const now = await actor(c);
      assert.equal(now.h, cora.h);
      assert.notEqual(now.g, cora.g);
      assert.equal(
        (await rest(now, 'rpc/set_reservation', original)).code,
        'FORBIDDEN',
      );
      assert.equal(
        (
          await rest(now, 'rpc/consume_item', {
            op: operationId(),
            h: now.h,
            g: cora.g,
            id: items[0],
            amount: '1',
            unit: 'Stück',
            confirm_full: false,
          })
        ).code,
        'FORBIDDEN',
      );
      const remove = await rest(owner, 'rpc/remove_member', {
        op: operationId(),
        h: owner.h,
        g: owner.g,
        target: now.user,
        target_g: cora.g,
      });
      assert.equal(remove.code, 'NOT_FOUND');
      await c.reload();
      await heading(c, 'WG A');
    },
  );
  return function verifyDissolution(done) {
    if (!done) {
      assert.deepEqual(stock(items[0]).reservations, { [owner.user]: 1 });
      return;
    }
    assert.deepEqual(items.map(stock), [null, null]);
    assert.match(owner.h, /^[a-f0-9-]{36}$/);
    assert.match(owner.user, /^[a-f0-9-]{36}$/);
    assert.equal(
      sql(`select (select count(*) from public.reservations where household_id='${owner.h}'),
      (select count(*) from public.households where id='${owner.h}'),
      (select count(*) from auth.users where id='${owner.user}'),
      (select count(*) from public.profiles where id='${owner.user}')`),
      '0|0|1|1',
    );
  };
}
