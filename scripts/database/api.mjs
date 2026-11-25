import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { createInterface } from 'node:readline';
import { setTimeout as delay } from 'node:timers/promises';
import { Buffer } from 'node:buffer';
import { test } from 'node:test';
import {
  api,
  container,
  docker,
  localStatus,
  project,
  sql,
  checkBindings,
} from './local.mjs';
import { invitation, operationId as op } from './fixtures.mjs';
import { addInventoryCases } from './inventory-api.mjs';

test('Auth, PostgREST, Haushaltsregeln und parallele Transaktionen', async (t) => {
  const status = localStatus();
  checkBindings();
  const guest = status.ANON_KEY;
  const admin = status.SERVICE_ROLE_KEY;
  assert.ok(guest && admin);
  const run = randomUUID();
  const start = new Date().toISOString();
  async function request(path, jwt, method = 'GET', body, extra = {}) {
    const response = await fetch(api + path, {
      method,
      headers: {
        apikey: jwt === admin ? admin : guest,
        Authorization: 'Bearer ' + jwt,
        'Content-Type': 'application/json',
        ...extra,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const s = await response.text();
    return { status: response.status, body: s ? JSON.parse(s) : null };
  }
  async function account(label, confirmed = true) {
    const email = project + '-' + run + '-' + label + '@example.invalid';
    const password = randomBytes(20).toString('hex');
    const created = await request('/auth/v1/admin/users', admin, 'POST', {
      email,
      password,
      email_confirm: confirmed,
    });
    assert.equal(created.status, 200);
    const login = await request(
      '/auth/v1/token?grant_type=password',
      guest,
      'POST',
      { email, password },
    );
    if (!confirmed) {
      assert.equal(login.status, 400);
      assert.equal(login.body.error_code, 'email_not_confirmed');
      return;
    }
    assert.equal(login.status, 200);
    return { id: created.body.id, jwt: login.body.access_token };
  }
  async function rpc(user, name, args) {
    const r = await request('/rest/v1/rpc/' + name, user.jwt, 'POST', args);
    assert.equal(
      r.status,
      200,
      name + ' HTTP ' + r.status + ' / ' + (r.body?.code ?? ''),
    );
    return r.body;
  }
  function success(r) {
    assert.equal(r.ok, true, r.code);
    return r;
  }
  function error(r, code) {
    assert.equal(r.ok, false);
    assert.equal(r.code, code);
  }
  async function rows(u, table, query = '') {
    const r = await request('/rest/v1/' + table + '?select=*' + query, u.jwt);
    assert.equal(r.status, 200);
    return r.body;
  }
  async function context(u) {
    const [m] = await rows(u, 'household_members', '&user_id=eq.' + u.id);
    return { h: m.household_id, g: m.generation };
  }
  async function makeInvite(u, ctx) {
    const secret = invitation();
    const args = { op: op(), ...ctx, hash: secret.hash };
    const receipt = success(await rpc(u, 'create_invite', args));
    assert.deepEqual(await rpc(u, 'create_invite', args), receipt);
    return { ...secret, id: receipt.id };
  }
  async function profiled(label) {
    const u = await account(label);
    success(
      await rpc(u, 'save_profile', {
        op: op(),
        name: '  ' + label + '  ',
        v: 0,
      }),
    );
    return u;
  }
  // Auth-E-Mails dieses Laufs begrenzen die Bereinigung auch nach einem Teilfehler.
  t.after(() => {
    localStatus();
    checkBindings();
    const ids =
      "select id from auth.users where email like '" +
      project +
      '-' +
      run +
      "-%@example.invalid'";
    sql(
      'begin; delete from public.households where owner_id in (' +
        ids +
        '); delete from auth.users where id in (' +
        ids +
        '); commit;',
    );
    assert.equal(sql('select count(*) from (' + ids + ') as remaining'), '0');
  });
  const people = [];
  for (const label of ['a', 'b', 'c', 'd', 'e', 'f'])
    people.push(await profiled(label));
  const [a, b, c, d, e, f] = people;
  let h1,
    h2,
    ac,
    dc,
    bc,
    cc,
    link,
    other,
    bJoin,
    warningVersion = 1;
  const cases = [];
  function check(name, fn) {
    cases.push([name, fn]);
  }
  check(
    'Bestätigung, Profil vor Haushalt, kanonischer Name und doppelte Erstellung',
    async () => {
      await account('unconfirmed', false);
      const blank = await account('blank');
      error(
        await rpc(blank, 'create_household', { op: op(), name: 'Test' }),
        'FORBIDDEN',
      );
      error(
        await rpc(blank, 'save_profile', {
          op: op(),
          h: null,
          g: null,
          v: 0,
          name: '\u00a0',
        }),
        'INVALID',
      );
      assert.equal((await rows(a, 'profiles')).length, 1);
      const calls = await Promise.all(
        [1, 2].map(() =>
          rpc(a, 'create_household', { op: op(), name: ' H1 ' }),
        ),
      );
      assert.equal(calls.filter((r) => r.ok).length, 1);
      error(
        calls.find((r) => !r.ok),
        'ALREADY_MEMBER',
      );
      h1 = calls.find((r) => r.ok).id;
      const same = { op: op(), name: 'H2' };
      const [first, second] = await Promise.all([
        rpc(d, 'create_household', same),
        rpc(d, 'create_household', same),
      ]);
      assert.deepEqual(success(first), success(second));
      h2 = first.id;
      ac = await context(a);
      dc = await context(d);
      assert.equal(ac.h, h1);
      assert.equal(dc.h, h2);
      assert.equal((await rows(a, 'households'))[0].warning_days, 3);
      assert.equal(
        sql(
          "select count(*) from public.households where owner_id in ('" +
            a.id +
            "','" +
            d.id +
            "')",
        ),
        '2',
      );
    },
  );
  check(
    'Vorschau, Einladungsmetadaten, drei Personen, zweite Haushaltsgrenze',
    async () => {
      link = await makeInvite(a, ac);
      other = await makeInvite(d, dc);
      error(
        await rpc(a, 'create_invite', { op: op(), ...ac, hash: link.hash }),
        'HASH_EXISTS',
      );
      error(
        await rpc(a, 'create_invite', { op: op(), ...ac, hash: 'x' }),
        'INVALID',
      );
      const preview = success(
        await rpc(b, 'preview_invite', { token: link.token }),
      );
      assert.equal(preview.household_name, 'H1');
      assert.equal(preview.id, null);
      assert.equal((await rows(b, 'household_members')).length, 0);
      const list = success(await rpc(a, 'list_invites', { h: h1 })).invites;
      assert.deepEqual(Object.keys(list[0]).sort(), [
        'created_at',
        'expires_at',
        'id',
        'revoked_at',
      ]);
      assert.equal(
        Date.parse(list[0].expires_at) - Date.parse(list[0].created_at),
        7 * 86400000,
      );
      bJoin = { op: op(), token: link.token };
      const joined = await Promise.all([
        rpc(b, 'join_household', bJoin),
        rpc(c, 'join_household', { op: op(), token: link.token }),
      ]);
      assert.ok(joined.every((r) => r.ok && r.id === h1));
      bc = await context(b);
      cc = await context(c);
      assert.deepEqual(
        (await rows(b, 'profiles')).map((p) => p.id).sort(),
        [a.id, b.id, c.id].sort(),
      );
      assert.equal((await rows(b, 'household_members')).length, 3);
      assert.deepEqual(await rows(d, 'households', '&id=eq.' + h1), []);
      assert.deepEqual(
        await rows(d, 'household_members', '&household_id=eq.' + h1),
        [],
      );
      assert.deepEqual(await rows(d, 'profiles', '&id=eq.' + a.id), []);
      assert.equal(
        (await rows(b, 'profiles')).some((p) => 'email' in p),
        false,
      );
      error(
        await rpc(a, 'preview_invite', { token: link.token }),
        'ALREADY_MEMBER',
      );
    },
  );
  addInventoryCases({
    check,
    actors: () => ({ a, b, c, d, e, ac, bc, cc, dc, link }),
    rpc,
    request,
    rows,
    context,
    profiled,
    success,
    error,
    guest,
  });
  check(
    'Direkte Tabellenrechte, interne Schemas, Gast-RPCs und fremde IDs',
    async () => {
      for (const u of [{ jwt: guest }, e, a, b, d]) {
        for (const [table, filter, body] of [
          ['profiles', 'id=eq.' + a.id, { id: a.id, display_name: 'Fremd' }],
          [
            'households',
            'id=eq.' + h1,
            { id: h1, name: 'Fremd', owner_id: d.id },
          ],
          [
            'household_members',
            'user_id=eq.' + a.id,
            { user_id: a.id, household_id: h2 },
          ],
          [
            'household_invites',
            'id=eq.' + link.id,
            { id: link.id, household_id: h2 },
          ],
        ]) {
          const read = await request('/rest/v1/' + table + '?' + filter, u.jwt);
          if (u.jwt === guest || table === 'household_invites')
            assert.ok(
              [401, 403, 404].includes(read.status) ||
                (read.status === 200 && read.body.length === 0),
            );
          for (const method of ['POST', 'PATCH', 'DELETE']) {
            const r = await request(
              '/rest/v1/' + table + '?' + filter,
              u.jwt,
              method,
              method === 'DELETE' ? undefined : body,
            );
            assert.ok(
              [401, 403, 404].includes(r.status),
              table + ' ' + method + ' ' + r.status,
            );
          }
        }
        for (const table of [
          'operation_results',
          'invite_attempts',
          'confirmed_self',
        ]) {
          const r = await request(
            '/rest/v1/' + table,
            u.jwt,
            'GET',
            undefined,
            { 'Accept-Profile': 'private' },
          );
          assert.equal(r.status, 406);
        }
      }
      const signatures = {
        save_profile: { op: op(), ...ac, name: 'x', v: 1 },
        create_household: { op: op(), name: 'x' },
        create_invite: { op: op(), ...ac, hash: link.hash },
        list_invites: { h: h1 },
        revoke_invite: { op: op(), ...ac, id: link.id },
        preview_invite: { token: link.token },
        join_household: { op: op(), token: link.token },
        leave_household: { op: op(), ...ac, confirm: true },
        remove_member: { op: op(), ...ac, target: b.id, target_g: bc.g },
        dissolve_household: { op: op(), ...ac, confirm: true },
        set_warning_days: { op: op(), ...ac, days: 1, v: 1 },
      };
      const extraRole = await request(
        '/rest/v1/rpc/set_warning_days',
        b.jwt,
        'POST',
        { ...signatures.set_warning_days, ...bc, owner: true },
      );
      assert.equal(extraRole.status, 404);
      const internal = await request(
        '/rest/v1/rpc/my_household',
        b.jwt,
        'POST',
        {},
      );
      assert.equal(internal.status, 404);
      error(
        await rpc(a, 'set_warning_days', {
          op: randomUUID(),
          ...ac,
          days: 3,
          v: 1,
        }),
        'INVALID',
      );
      for (const [name, args] of Object.entries(signatures)) {
        const r = await request('/rest/v1/rpc/' + name, guest, 'POST', args);
        assert.ok([401, 403, 404].includes(r.status), name);
        if ('h' in args) error(await rpc(d, name, args), 'FORBIDDEN');
      }
      for (const name of [
        'list_invites',
        'create_invite',
        'revoke_invite',
        'remove_member',
        'dissolve_household',
        'set_warning_days',
      ]) {
        const args = { ...signatures[name], ...bc };
        if (name === 'list_invites') delete args.g;
        error(await rpc(b, name, args), 'FORBIDDEN');
      }
      error(
        await rpc(a, 'remove_member', {
          op: op(),
          ...ac,
          target: d.id,
          target_g: dc.g,
        }),
        'NOT_FOUND',
      );
      error(
        await rpc(a, 'remove_member', {
          op: op(),
          ...ac,
          target: a.id,
          target_g: ac.g,
        }),
        'OWNER_BOUND',
      );
      error(
        await rpc(a, 'leave_household', { op: op(), ...ac, confirm: true }),
        'OWNER_BOUND',
      );
      error(
        await rpc(a, 'dissolve_household', { op: op(), ...ac, confirm: true }),
        'OWNER_BOUND',
      );
      error(
        await rpc(b, 'leave_household', { op: op(), ...bc, confirm: false }),
        'CONFIRM_REQUIRED',
      );
      error(
        await rpc(a, 'revoke_invite', { op: op(), ...ac, id: other.id }),
        'NOT_FOUND',
      );
    },
  );
  check(
    'Warnfrist, exakte Eingaben, Wiederholung, Konflikt und veraltete Versionen',
    async () => {
      for (const days of [0, 3, 7, 30]) {
        const args = { op: op(), ...ac, days, v: warningVersion };
        const r = success(await rpc(a, 'set_warning_days', args));
        assert.equal(r.version, ++warningVersion);
        assert.deepEqual(await rpc(a, 'set_warning_days', args), r);
        error(
          await rpc(a, 'set_warning_days', { ...args, days: 2 }),
          'OP_MISMATCH',
        );
        error(
          await rpc(a, 'save_profile', { op: args.op, ...ac, name: 'a', v: 1 }),
          'OP_MISMATCH',
        );
      }
      for (const days of [-1, 31, 2.5, null, 'kaputt'])
        error(
          await rpc(a, 'set_warning_days', {
            op: op(),
            ...ac,
            days,
            v: warningVersion,
          }),
          'INVALID',
        );
      const pair = await Promise.all(
        [4, 5].map((days) =>
          rpc(a, 'set_warning_days', {
            op: op(),
            ...ac,
            days,
            v: warningVersion,
          }),
        ),
      );
      assert.equal(success(pair.find((r) => r.ok)).version, ++warningVersion);
      error(
        pair.find((r) => !r.ok),
        'STALE',
      );
      const profile = await Promise.all(
        ['c1', 'c2'].map((name) =>
          rpc(c, 'save_profile', { op: op(), ...cc, name, v: 1 }),
        ),
      );
      assert.equal(success(profile.find((r) => r.ok)).version, 2);
      error(
        profile.find((r) => !r.ok),
        'STALE',
      );
      error(
        await rpc(a, 'set_warning_days', {
          op: op(Date.now() - 86401000),
          ...ac,
          days: 2,
          v: warningVersion,
        }),
        'OP_EXPIRED',
      );
      error(
        await rpc(a, 'set_warning_days', {
          op: op(Date.now() + 301000),
          ...ac,
          days: 2,
          v: warningVersion,
        }),
        'OP_EXPIRED',
      );
    },
  );
  check(
    'Gemeinsames Budget bei 24 parallelen Vorschauen und Einlösungen, Verfall und Reset',
    async () => {
      const responses = await Promise.all(
        Array.from({ length: 24 }, (_, i) =>
          i % 2
            ? rpc(e, 'preview_invite', { token: 'ungültig' })
            : rpc(e, 'join_household', { op: op(), token: 'x' }),
        ),
      );
      assert.equal(
        responses.filter((r) => r.code === 'INVITE_INVALID').length,
        20,
      );
      assert.equal(
        responses.filter((r) => r.code === 'RATE_LIMITED' && r.retry_after > 0)
          .length,
        4,
      );
      assert.equal(
        sql(
          "select attempts from private.invite_attempts where user_id='" +
            e.id +
            "'",
        ),
        '20',
      );
      assert.equal(
        sql(
          "select count(*) from private.operation_results where operation='join_household' and user_id='" +
            e.id +
            "'",
        ),
        '0',
      );
      sql(
        "update private.invite_attempts set window_start=now()-interval '11 minutes' where user_id='" +
          e.id +
          "'",
      );
      success(await rpc(e, 'preview_invite', { token: link.token }));
      for (const token of [
        link.token + '=',
        Buffer.from(link.hash.slice(2), 'hex').toString('base64url'),
        link.token.slice(0, -1) + 'B',
        '',
        null,
      ])
        error(await rpc(e, 'preview_invite', { token }), 'INVITE_INVALID');
      const expired = await makeInvite(a, ac);
      sql(
        "update public.household_invites set created_at=now()-interval '8 days',expires_at=now()-interval '1 day' where id='" +
          expired.id +
          "'",
      );
      for (const name of ['preview_invite', 'join_household'])
        error(
          await rpc(e, name, {
            token: expired.token,
            ...(name === 'join_household' ? { op: op() } : {}),
          }),
          'INVITE_INVALID',
        );
    },
  );
  check('Ein Konto tritt parallel zwei Haushalten bei', async () => {
    const pair = await Promise.all(
      [link, other].map((i) =>
        rpc(e, 'join_household', { op: op(), token: i.token }),
      ),
    );
    assert.equal(pair.filter((r) => r.ok).length, 1);
    error(
      pair.find((r) => !r.ok),
      'ALREADY_MEMBER',
    );
    const ec = await context(e);
    assert.equal(ec.h, pair.find((r) => r.ok).id);
    success(
      await rpc(e, 'leave_household', { op: op(), ...ec, confirm: true }),
    );
  });
  check(
    'Einladung verfällt während nachgewiesener Haushaltssperre',
    async () => {
      const invite = await makeInvite(a, ac);
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
      try {
        const ready = once(lines, 'line');
        locker.stdin.write(
          "begin; select pg_backend_pid() from public.households where id='" +
            h1 +
            "' for update;\n",
        );
        const [pid] = await ready;
        assert.match(pid, /^\d+$/);
        const pending = rpc(f, 'join_household', {
          op: op(),
          token: invite.token,
        });
        let waiting = false;
        for (let i = 0; i < 30 && !waiting; i++) {
          waiting =
            sql(
              'select exists(select from pg_stat_activity where ' +
                pid +
                "=any(pg_blocking_pids(pid)) and query ilike '%join_household%')",
            ) === 't';
          if (!waiting) await delay(50);
        }
        assert.ok(waiting, 'Beitritt wartet auf die gesperrte Haushaltszeile');
        locker.stdin.end(
          "update public.household_invites set expires_at=clock_timestamp() where id='" +
            invite.id +
            "'; commit;\n",
        );
        assert.equal((await exited)[0], 0);
        error(await pending, 'INVITE_INVALID');
        assert.deepEqual(await rows(f, 'household_members'), []);
      } finally {
        lines.close();
        if (!locker.stdin.writableEnded) locker.stdin.end('rollback;\n');
        await exited;
      }
    },
  );
  check(
    'Widerruf und Einlösung auf unabhängigen HTTP-Verbindungen',
    async () => {
      const invite = await makeInvite(a, ac);
      const [join, revoke] = await Promise.all([
        rpc(f, 'join_household', { op: op(), token: invite.token }),
        rpc(a, 'revoke_invite', { op: op(), ...ac, id: invite.id }),
      ]);
      success(revoke);
      const visible = await rows(f, 'household_members', '&user_id=eq.' + f.id);
      if (join.ok) {
        assert.equal(visible[0].household_id, h1);
        success(
          await rpc(f, 'leave_household', {
            op: op(),
            ...(await context(f)),
            confirm: true,
          }),
        );
      } else {
        error(join, 'INVITE_INVALID');
        assert.equal(visible.length, 0);
      }
      error(
        await rpc(f, 'join_household', { op: op(), token: invite.token }),
        'INVITE_INVALID',
      );
      error(
        await rpc(f, 'preview_invite', { token: invite.token }),
        'INVITE_INVALID',
      );
    },
  );
  check(
    'Auflösung und Einlösung konkurrieren, Bestätigung und Kaskade',
    async () => {
      error(
        await rpc(d, 'dissolve_household', { op: op(), ...dc, confirm: false }),
        'CONFIRM_REQUIRED',
      );
      const dissolve = { op: op(), ...dc, confirm: true };
      const [join, close] = await Promise.all([
        rpc(f, 'join_household', { op: op(), token: other.token }),
        rpc(d, 'dissolve_household', dissolve),
      ]);
      if (join.ok) {
        error(close, 'OWNER_BOUND');
        success(
          await rpc(f, 'leave_household', {
            op: op(),
            ...(await context(f)),
            confirm: true,
          }),
        );
        success(await rpc(d, 'dissolve_household', dissolve));
      } else {
        error(join, 'INVITE_INVALID');
        success(close);
      }
      success(await rpc(d, 'dissolve_household', dissolve));
      assert.equal(
        sql(
          "select (select count(*) from public.households where id='" +
            h2 +
            "')+(select count(*) from public.household_invites where household_id='" +
            h2 +
            "')+(select count(*) from public.household_members where household_id='" +
            h2 +
            "')",
        ),
        '0',
      );
      assert.equal((await rows(d, 'profiles'))[0].id, d.id);
    },
  );
  check(
    'Entfernung gegen Profiländerung, altes JWT und alte Generation nach Wiederbeitritt',
    async () => {
      const first = { op: op(), ...bc, name: 'vor Austritt', v: 1 };
      success(await rpc(b, 'save_profile', first));
      const change = { op: op(), ...bc, name: 'gleichzeitig', v: 2 };
      const delayedRemoval = { op: op(), ...ac, target: b.id, target_g: bc.g };
      const [result, removed] = await Promise.all([
        rpc(b, 'save_profile', change),
        rpc(a, 'remove_member', {
          op: op(),
          ...ac,
          target: b.id,
          target_g: bc.g,
        }),
      ]);
      success(removed);
      if (!result.ok) error(result, 'FORBIDDEN');
      assert.deepEqual(await rows(b, 'households'), []);
      assert.deepEqual(await rows(b, 'household_members'), []);
      const own = await rows(b, 'profiles');
      assert.equal(own.length, 1);
      assert.equal(own[0].version, result.ok ? 3 : 2);
      error(await rpc(b, 'save_profile', first), 'FORBIDDEN');
      error(await rpc(b, 'join_household', bJoin), 'FORBIDDEN');
      error(
        await rpc(b, 'set_warning_days', {
          op: op(),
          ...bc,
          days: 7,
          v: warningVersion,
        }),
        'FORBIDDEN',
      );
      success(await rpc(b, 'join_household', { op: op(), token: link.token }));
      assert.notEqual((await context(b)).g, bc.g);
      error(await rpc(a, 'remove_member', delayedRemoval), 'NOT_FOUND');
      error(await rpc(b, 'save_profile', first), 'FORBIDDEN');
      error(
        await rpc(b, 'save_profile', {
          op: op(),
          ...bc,
          name: 'verspätet',
          v: own[0].version,
        }),
        'FORBIDDEN',
      );
      error(await rpc(b, 'join_household', bJoin), 'FORBIDDEN');
      const leave = { op: op(), ...(await context(b)), confirm: true };
      const closed = success(await rpc(b, 'leave_household', leave));
      assert.deepEqual(await rpc(b, 'leave_household', leave), closed);
    },
  );
  check(
    'Begrenzte Aufbewahrung, unveränderte Daten nach Replay und lokale Logmarker',
    async () => {
      const aged = op(Date.now() - 3 * 86400000);
      sql(
        "insert into private.operation_results(user_id,operation_id,operation,request_hash,result,created_at) values ('" +
          a.id +
          "','" +
          aged +
          "','test',sha256('test'::bytea),'{}',now()-interval '3 days'); update private.invite_attempts set window_start=now()-interval '2 days' where user_id='" +
          e.id +
          "'",
      );
      sql(
        "insert into private.operation_results(user_id,operation_id,operation,request_hash,result,created_at) select '" +
          a.id +
          "',gen_random_uuid(),'cleanup',sha256('test'::bytea),'{}',now()-interval '49 hours' from generate_series(1,40)",
      );
      success(
        await rpc(a, 'save_profile', {
          op: op(),
          ...ac,
          name: 'Prüfung',
          v: 1,
        }),
      );
      assert.equal(
        sql(
          "select count(*) from private.operation_results where user_id='" +
            a.id +
            "' and operation='cleanup'",
        ),
        '9',
      );
      assert.equal(
        sql(
          "select count(*) from private.operation_results where operation_id='" +
            aged +
            "'",
        ),
        '0',
      );
      assert.equal(
        sql(
          "select count(*) from private.invite_attempts where user_id='" +
            e.id +
            "'",
        ),
        '0',
      );
      error(
        await rpc(a, 'set_warning_days', {
          op: aged,
          ...ac,
          days: 6,
          v: warningVersion,
        }),
        'OP_EXPIRED',
      );
      assert.equal((await rows(a, 'households'))[0].version, warningVersion);
      const markers = [
        link.token,
        link.hash.slice(2),
        Buffer.from(link.hash.slice(2), 'hex').toString('base64'),
      ];
      for (const service of ['db', 'kong', 'rest', 'auth']) {
        const logs = spawnSync(
          'docker',
          ['logs', '--since', start, 'supabase_' + service + '_' + project],
          { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 },
        );
        assert.equal(logs.status, 0);
        assert.ok(
          markers.every((m) => !(logs.stdout + logs.stderr).includes(m)),
          service + ' enthält einen Einladungsmarker',
        );
      }
      const values = sql(
        "select result::text || encode(request_hash,'hex') from private.operation_results where user_id='" +
          a.id +
          "'",
      );
      assert.ok(markers.every((m) => !values.includes(m)));
      assert.ok(
        docker('inspect', '--format', '{{.State.Running}}', container) ===
          'true',
      );
    },
  );
  for (const [name, fn] of cases) {
    let passed = false;
    await t.test(name, async () => {
      await fn();
      passed = true;
    });
    if (!passed) break;
  }
});
