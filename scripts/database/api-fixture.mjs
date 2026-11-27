import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { api, localStatus, project, sql, checkBindings } from './local.mjs';
import { invitation, operationId as op } from './fixtures.mjs';

export function apiFixture(t) {
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
    return {
      id: created.body.id,
      jwt: login.body.access_token,
      refresh: login.body.refresh_token,
    };
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

  return {
    guest,
    start,
    request,
    account,
    rpc,
    success,
    error,
    rows,
    context,
    makeInvite,
    profiled,
  };
}
