import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { setTimeout as delay } from 'node:timers/promises';
import { test } from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { api } from './local.mjs';
import { apiFixture } from './api-fixture.mjs';
import { operationId as op } from './fixtures.mjs';

async function watch(user, key, household) {
  const client = createClient(api, key, { accessToken: async () => user.jwt });
  await client.realtime.setAuth(user.jwt);
  const events = [];
  const statuses = [];
  const channel = client
    .channel('signal-' + randomUUID(), {
      config: { postgres_changes_options: { wait: true } },
    })
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'household_signals',
        ...(household ? { filter: 'id=eq.' + household } : {}),
      },
      (payload) => events.push({ payload, time: performance.now() }),
    );
  try {
    await new Promise((resolve, reject) => {
      channel.subscribe((status) => {
        statuses.push(status);
        if (status === 'SUBSCRIBED') resolve();
        else reject(new Error('Signalabonnement ' + status));
      }, 15000);
    });
  } catch (error) {
    await client.removeAllChannels();
    throw error;
  }
  return { client, events, statuses, close: () => client.removeAllChannels() };
}
async function received(watcher, h, revision) {
  const end = performance.now() + 10000;
  while (performance.now() < end) {
    const event = watcher.events.find(
      (e) =>
        e.payload.new.id === h && Number(e.payload.new.revision) === revision,
    );
    if (event) {
      assert.deepEqual(Object.keys(event.payload.new).sort(), [
        'id',
        'revision',
      ]);
      assert.ok(Object.keys(event.payload.old).every((k) => k === 'id'));
      return event.time;
    }
    await delay(20);
  }
  assert.fail(
    'Signalrevision ' +
      revision +
      ' ausgeblieben. Kanalzustände ' +
      watcher.statuses.join(','),
  );
}

test('Echte WebSockets mit Haushalts-RLS, Entzug, Wiederbeitritt und Wiederverbindung', async (t) => {
  const { profiled, rpc, success, context, rows, guest, request, makeInvite } =
    apiFixture(t);
  const [owner, member, foreign, blank] = await Promise.all(
    ['owner', 'mitglied', 'fremd', 'frei'].map(profiled),
  );
  const call = (u, ctx, name, args) =>
    rpc(u, name, { op: op(), ...ctx, ...args }).then(success);
  for (const u of [owner, foreign])
    await call(u, {}, 'create_household', { name: 'Test' });
  const ac = await context(owner),
    fc = await context(foreign);
  const invite = await makeInvite(owner, ac);
  await call(member, {}, 'join_household', { token: invite.token });
  const mc = await context(member);
  const subscriptions = [];
  const open = async (u, filter) => {
    const watcher = await watch(u, guest, filter);
    subscriptions.push(watcher);
    return watcher;
  };
  t.after(async () => {
    for (const s of subscriptions) await s.close();
  });
  const home = await open(owner, ac.h);
  const memberAll = await open(member);
  const wrong = await open(foreign, ac.h);
  const foreignAll = await open(foreign);
  const noHouse = await open(blank);
  const rev = async (u) => (await rows(u, 'household_signals'))[0].revision;
  const change = (u, ctx) =>
    call(u, ctx, 'create_shopping', { fields: { name: 'Brot' } });
  const samples = [];
  let revision = await rev(owner);
  for (let i = 0; i < 10; i++) {
    const start = performance.now();
    await change(owner, ac);
    revision++;
    const end = await received(home, ac.h, revision);
    await received(memberAll, ac.h, revision);
    samples.push(Math.round(end - start));
  }
  t.diagnostic(
    'RPC-Start bis UPDATE-Callback in ms (10 Messwerte): ' + samples.join(', '),
  );
  assert.ok(
    Math.max(...samples) < 3000,
    'Lokale Zustellung unter drei Sekunden',
  );
  await change(foreign, fc);
  await received(foreignAll, fc.h, await rev(foreign));
  assert.ok(memberAll.events.every((e) => e.payload.new.id === ac.h));
  const cutoff = revision;
  await call(owner, ac, 'remove_member', { target: member.id, target_g: mc.g });
  await received(home, ac.h, ++revision);
  const oldSocket = await open(member, ac.h);
  await change(owner, ac);
  await received(home, ac.h, ++revision);
  // Positivkontrolle auf demselben Replikationsstrom, zusätzliches Beobachtungsfenster.
  await delay(3200);
  assert.ok(memberAll.events.every((e) => e.payload.new.revision <= cutoff));
  assert.equal(oldSocket.events.length, 0);
  assert.deepEqual(await rows(member, 'household_signals'), []);
  const refreshed = await request(
    '/auth/v1/token?grant_type=refresh_token',
    guest,
    'POST',
    { refresh_token: member.refresh },
  );
  assert.equal(refreshed.status, 200);
  member.jwt = refreshed.body.access_token;
  await memberAll.client.realtime.setAuth(member.jwt);
  await change(owner, ac);
  await received(home, ac.h, ++revision);
  await delay(3200);
  assert.ok(memberAll.events.every((e) => e.payload.new.revision <= cutoff));
  assert.equal(oldSocket.events.length, 0);
  assert.deepEqual(memberAll.statuses, ['SUBSCRIBED']);
  assert.deepEqual(oldSocket.statuses, ['SUBSCRIBED']);
  await call(member, {}, 'join_household', { token: invite.token });
  assert.notEqual((await context(member)).g, mc.g);
  await received(home, ac.h, ++revision);
  await received(memberAll, ac.h, revision);
  await received(oldSocket, ac.h, revision);
  const last = await rev(member);
  await memberAll.close();
  await change(owner, ac);
  await received(home, ac.h, ++revision);
  const reconnect = await open(member, ac.h);
  assert.equal(await rev(member), last + 1);
  await change(owner, ac);
  await received(reconnect, ac.h, ++revision);
  await received(home, ac.h, revision);
  assert.ok((await rows(member, 'shopping_items')).length >= 10);
  await delay(1000);
  for (const s of [wrong, noHouse]) {
    assert.deepEqual(s.statuses, ['SUBSCRIBED']);
    assert.equal(s.events.length, 0);
  }
  assert.ok(foreignAll.events.every((e) => e.payload.new.id === fc.h));
  assert.ok(home.events.every((e) => e.payload.new.id === ac.h));
});
