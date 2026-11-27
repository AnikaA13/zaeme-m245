/* global document, window, innerWidth -- Callbacks in Playwrights Browserkontext. */
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { setTimeout as wait } from 'node:timers/promises';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { householdInventory } from './browser-inventory.mjs';
import {
  api,
  mail,
  browserPort,
  localStatus,
  checkBindings,
  sql,
} from './local.mjs';

const stack = localStatus();
checkBindings();
const origin = 'http://127.0.0.1:' + browserPort;
assert.equal(stack.MAILPIT_URL ?? stack.INBUCKET_URL, mail);
process.env.VITE_SUPABASE_URL = api;
process.env.VITE_SUPABASE_PUBLISHABLE_KEY =
  stack.PUBLISHABLE_KEY || stack.ANON_KEY;
const run = randomUUID(),
  password = randomBytes(18).toString('hex');
const address = (n) => 'task006-' + run + '-' + n + '@example.invalid';
const messages = new Set();
let browser,
  server,
  stage = 'Start';
async function step(name, fn) {
  stage = name;
  await fn();
  console.log('PASS ' + name);
}
async function page() {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    locale: 'de-CH',
  });
  await context.route('**/*', (route) =>
    [origin, api].includes(new URL(route.request().url()).origin)
      ? route.continue()
      : route.abort(),
  );
  const p = await context.newPage();
  p.setDefaultTimeout(20000);
  return p;
}
const button = (p, name) => p.getByRole('button', { name, exact: true });
const link = (p, name) => p.getByRole('link', { name, exact: true });
const heading = (p, name) =>
  p.getByRole('heading', { name, exact: true }).waitFor();
async function fillAuthEmail(p, title, email) {
  // Die drei Auth-Formulare haben gleich beschriftete E-Mail-Felder.
  await heading(p, title);
  await p.getByLabel('E-Mail-Adresse').fill(email);
}
async function mailLink(email, kind, skip = new Set()) {
  for (let i = 0; i < 40; i++) {
    const result = await fetch(
      mail + '/api/v1/search?query=' + encodeURIComponent('to:' + email),
    );
    for (const m of (await result.json()).messages ?? []) {
      if (skip.has(m.ID)) continue;
      const data = await (await fetch(mail + '/api/v1/message/' + m.ID)).json();
      messages.add(m.ID);
      for (const match of data.Text.matchAll(/https?:\/\/[^\s<>")]+/g)) {
        const url = new URL(match[0].replaceAll('&amp;', '&'));
        if (
          url.origin === api &&
          url.pathname === '/auth/v1/verify' &&
          url.searchParams.get('type') === kind
        )
          return url.href;
      }
    }
    await wait(250);
  }
  throw new Error();
}
async function register(p, n) {
  await link(p, 'Konto erstellen').click();
  await fillAuthEmail(p, 'Konto erstellen', address(n));
  if (n === 'Anna') await layout(p);
  await p.getByLabel('Passwort', { exact: true }).fill(password);
  const [signup] = await Promise.all([
    p.waitForResponse(
      (r) =>
        r.url().startsWith(api + '/auth/v1/signup') &&
        r.request().method() === 'POST',
    ),
    button(p, 'Konto erstellen').click(),
  ]);
  assert.equal(signup.status(), 200, 'Registrierung über GoTrue');
  await heading(p, 'E-Mail bestätigen');
  const skip = new Set();
  if (n === 'Anna') {
    await mailLink(address(n), 'signup');
    for (const id of messages) skip.add(id);
    await p
      .getByRole('button', { name: 'Erneut senden', exact: true })
      .click({ timeout: 45000 });
    await p.getByText(/Falls eine Bestätigung aussteht/).waitFor();
  }
  await p.goto(await mailLink(address(n), 'signup', skip));
  await heading(p, 'Wie heisst du?');
  if (n === 'Anna') await layout(p);
  assert.equal(new URL(p.url()).search + new URL(p.url()).hash, '');
  await p.getByLabel('Anzeigename', { exact: true }).fill(n);
  await button(p, 'Namen speichern').click();
}
async function login(p, n, pw = password) {
  await p.goto(origin + '/auth/login');
  await fillAuthEmail(p, 'Anmelden', address(n));
  await p.getByLabel('Passwort', { exact: true }).fill(pw);
  await button(p, 'Anmelden').click();
}
async function signOut(p) {
  await button(p, 'Abmelden').click();
  await link(p, 'Anmelden').waitFor();
}
async function join(p) {
  await button(p, 'Einladung prüfen').click();
  await p.getByText('Möchtest du dem Haushalt', { exact: false }).waitFor();
  await button(p, 'Beitritt bestätigen').click();
  await p.waitForFunction(
    () =>
      document.body.textContent.includes('Zum Haushalt') ||
      document.body.textContent.includes('Haushalt öffnen'),
  );
  await p.goto(origin + '/household');
  await heading(p, 'WG A');
}
async function confirm(p, action, accept = true) {
  p.once('dialog', (d) => (accept ? d.accept() : d.dismiss()));
  await button(p, action).click();
}
async function layout(p) {
  for (const width of [320, 375, 390, 430, 1280]) {
    await p.setViewportSize({ width, height: 844 });
    for (const size of ['100%', '200%']) {
      const fits = await p.evaluate((size) => {
        document.documentElement.style.fontSize = size;
        const targets = [...document.querySelectorAll('a,button,input,summary')]
          .map((el) => el.getBoundingClientRect())
          .filter((r) => r.width && r.height);
        return (
          targets.every((r) => r.height >= 44 && r.width >= 44) &&
          document.documentElement.scrollWidth <= innerWidth
        );
      }, size);
      assert.ok(fits, 'Horizontales Scrollen');
    }
  }
  await p.evaluate(() => {
    document.documentElement.style.fontSize = '100%';
  });
  await p.setViewportSize({ width: 390, height: 844 });
}
let a, b, c, d, invitation;
try {
  server = await createServer({
    logLevel: 'silent',
    server: {
      host: '127.0.0.1',
      port: browserPort,
      strictPort: true,
      hmr: false,
    },
  });
  await server.listen();
  assert.ok(server.resolvedUrls.local.includes(origin + '/'));
  browser = await chromium.launch();
  await step('A Registrierung und Bestätigung', async () => {
    a = await page();
    await a.goto(origin);
    await heading(a, 'Gemeinsam alles im Blick.');
    await layout(a);
    await link(a, 'Anmelden').click();
    await register(a, 'Anna');
    await heading(a, 'Dein Haushalt');
  });
  await step('B Haushalt und Reload', async () => {
    await link(a, 'Haushalt erstellen').click();
    await a.getByLabel('Haushaltsname').fill('WG A');
    await button(a, 'Haushalt erstellen').click();
    await link(a, 'Haushalt öffnen').click();
    await heading(a, 'WG A');
    await a.reload();
    await heading(a, 'WG A');
    await a.getByText('Du · Eigentümer:in').waitFor();
    await button(a, 'Anzeigenamen bearbeiten').click();
    await a.getByLabel('Anzeigename', { exact: true }).fill('Anna A');
    await button(a, 'Namen speichern').click();
    await a.locator('li strong', { hasText: 'Anna A' }).waitFor();
  });
  await step('C Einladung und bewusster Beitritt', async () => {
    assert.equal(await a.getByLabel('Einladungslink').count(), 0);
    let original;
    await a.route(
      '**/rest/v1/rpc/create_invite',
      async (route) => {
        original = route.request().postData();
        const persisted = await route.fetch();
        assert.equal((await persisted.json()).ok, true);
        await route.abort('failed');
      },
      { times: 1 },
    );
    await button(a, 'Einladung erstellen').click();
    await a.getByRole('alert').filter({ hasText: 'Antwort fehlt' }).waitFor();
    assert.equal(await a.getByLabel('Einladungslink').count(), 0);
    const retry = a.waitForRequest(
      (r) =>
        r.url() === api + '/rest/v1/rpc/create_invite' && r.method() === 'POST',
    );
    await button(a, 'Einladung erstellen').click();
    invitation = await a.getByLabel('Einladungslink').inputValue();
    assert.ok(original && (await retry).postData() === original);
    await layout(a);
    b = await page();
    await b.goto(invitation);
    await heading(b, 'Haushalt beitreten');
    assert.equal(new URL(b.url()).hash, '');
    assert.equal(await b.getByText('WG A').count(), 0);
    await register(b, 'Bea');
    await join(b);
    await a.reload();
    await a.getByText('Bea', { exact: true }).waitFor();
    assert.equal(await button(b, 'Einladung erstellen').count(), 0);
  });
  await step('D Drittes Mitglied mit manuellem Code', async () => {
    c = await page();
    await c.goto(origin + '/join');
    await c
      .getByLabel('Einladungscode')
      .fill(
        new URLSearchParams(new URL(invitation).hash.slice(1)).get('invite'),
      );
    await register(c, 'Cora');
    await join(c);
    await a.reload();
    await a.getByText('Cora', { exact: true }).waitFor();
    assert.equal(
      await a
        .locator('section')
        .filter({ has: a.getByRole('heading', { name: 'Mitglieder' }) })
        .locator('li')
        .count(),
      3,
    );
    await layout(a);
    assert.equal(
      (await button(a, 'Haushalt verlassen').count()) +
        (await button(a, 'Haushalt auflösen').count()),
      0,
    );
  });
  const verifyDissolution = await householdInventory({
    a,
    b,
    c,
    invitation,
    join,
    confirm,
    heading,
    step,
    publicKey: process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  });
  await step('E Getrennter Haushalt und RLS', async () => {
    d = await page();
    await d.goto(origin + '/auth/login');
    await register(d, 'Dani');
    await link(d, 'Haushalt erstellen').click();
    await d.getByLabel('Haushaltsname').fill('WG D');
    await button(d, 'Haushalt erstellen').click();
    await link(d, 'Haushalt öffnen').click();
    await heading(d, 'WG D');
    assert.equal(await d.getByText('Anna A', { exact: true }).count(), 0);
    const foreign = await d.evaluate(async () => {
      const { backend } = await import('/src/lib/supabase/client.ts');
      const r = await backend().from('households').select('name');
      return !r.error && r.data.every((h) => h.name === 'WG D');
    });
    assert.ok(foreign);
  });
  await step('F Einladung widerrufen', async () => {
    await confirm(a, 'Einladung widerrufen');
    await a.getByText('Widerrufen', { exact: true }).waitFor();
    await confirm(d, 'Haushalt auflösen');
    await heading(d, 'Dein Haushalt');
    await d.goto(invitation);
    await button(d, 'Einladung prüfen').click();
    await d.getByRole('alert').filter({ hasText: 'widerrufen' }).waitFor();
  });
  await step('G Entzug und erneute Zugangsprüfung', async () => {
    await button(b, 'Anzeigenamen bearbeiten').click();
    await b.getByLabel('Anzeigename', { exact: true }).fill('Bea Neu');
    await confirm(a, 'Bea entfernen');
    await a.getByText('Bea', { exact: true }).waitFor({ state: 'detached' });
    const denied = b.waitForResponse(
      (r) =>
        r.url() === api + '/rest/v1/rpc/save_profile' &&
        r.request().method() === 'POST',
    );
    await button(b, 'Namen speichern').click();
    assert.equal((await (await denied).json()).code, 'FORBIDDEN');
    await b.evaluate(() => window.dispatchEvent(new Event('focus')));
    await heading(b, 'Dein Haushalt');
    assert.equal(await b.getByText('WG A', { exact: true }).count(), 0);
  });
  await step('H Abmeldung und Kontowechsel', async () => {
    // Alte echte Profilantwort zurückhalten, während im selben Dokument das Konto wechselt.
    let captured, release, finished;
    const intercepted = new Promise((resolve) => {
        captured = resolve;
      }),
      gate = new Promise((resolve) => {
        release = resolve;
      });
    const returned = new Promise((resolve) => {
      finished = resolve;
    });
    await b.route(
      '**/rest/v1/profiles?*',
      async (route) => {
        const response = await route.fetch();
        captured();
        await gate;
        try {
          await route.fulfill({ response });
        } catch {
          /* Die alte Sitzung hat den Request abgebrochen. */
        } finally {
          finished();
        }
      },
      { times: 1 },
    );
    await b.evaluate(() => window.dispatchEvent(new Event('focus')));
    await Promise.race([
      intercepted,
      wait(8000).then(() => {
        throw new Error();
      }),
    ]);
    try {
      await signOut(b);
      await link(b, 'Anmelden').click();
      await fillAuthEmail(b, 'Anmelden', address('Dani'));
      await b.getByLabel('Passwort', { exact: true }).fill(password);
      await button(b, 'Anmelden').click();
      await heading(b, 'Dein Haushalt');
    } finally {
      release();
    }
    await returned;
    await b.getByText('Anzeigenamen bearbeiten', { exact: true }).click();
    assert.equal(
      await b.getByLabel('Anzeigename', { exact: true }).inputValue(),
      'Dani',
    );
  });
  await step('I Passwortwiederherstellung', async () => {
    await signOut(b);
    await link(b, 'Anmelden').click();
    await link(b, 'Passwort vergessen?').click();
    await fillAuthEmail(b, 'Passwort vergessen?', address('Bea'));
    await button(b, 'Link anfordern').click();
    await b
      .getByRole('status')
      .filter({ hasText: 'Post' })
      .or(b.getByText(/Falls ein Konto/))
      .first()
      .waitFor();
    await b.goto(await mailLink(address('Bea'), 'recovery'));
    await heading(b, 'Neues Passwort setzen');
    assert.equal(new URL(b.url()).search + new URL(b.url()).hash, '');
    await layout(b);
    const changed = randomBytes(20).toString('hex');
    await b.getByLabel('Neues Passwort', { exact: true }).fill(changed);
    await b.getByLabel('Passwort bestätigen', { exact: true }).fill(changed);
    await button(b, 'Passwort speichern').click();
    await heading(b, 'Dein Haushalt');
    await signOut(b);
    await login(b, 'Bea');
    await b.getByRole('alert').filter({ hasText: 'stimmen nicht' }).waitFor();
    await login(b, 'Bea', changed);
    await heading(b, 'Dein Haushalt');
    await b.goto(origin + '/auth/reset-password?type=recovery');
    await heading(b, 'Link nicht mehr gültig');
    assert.equal(
      await b.getByLabel('Neues Passwort', { exact: true }).count(),
      0,
    );
  });
  await step('J Austritt und Auflösung', async () => {
    await confirm(c, 'Haushalt verlassen', false);
    await heading(c, 'WG A');
    await confirm(c, 'Haushalt verlassen');
    await heading(c, 'Dein Haushalt');
    await a.reload();
    await heading(a, 'WG A');
    verifyDissolution(false);
    await confirm(a, 'Haushalt auflösen');
    await heading(a, 'Dein Haushalt');
    verifyDissolution(true);
    await a.reload();
    await heading(a, 'Dein Haushalt');
    await signOut(a);
    await login(a, 'Anna');
    await heading(a, 'Dein Haushalt');
  });
  await step('Lokale Abmeldung bei Verbindungsfehler', async () => {
    await a.route('**/auth/v1/logout*', (r) =>
      r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }),
    );
    await button(a, 'Abmelden').click();
    await heading(a, 'Gemeinsam alles im Blick.');
    await a
      .getByRole('status')
      .filter({ hasText: 'beim Server konnte nicht bestätigt werden' })
      .waitFor();
    await a.goto(origin + '/household');
    await heading(a, 'Anmelden');
    assert.equal(await button(a, 'Abmelden').count(), 0);
  });
  await step('Verspätete Mutation nach Kontowechsel', async () => {
    const p = await page();
    await login(p, 'Anna');
    await heading(p, 'Dein Haushalt');
    await p.getByText('Anzeigenamen bearbeiten', { exact: true }).click();
    await p
      .getByLabel('Anzeigename', { exact: true })
      .fill('Anna nach Auflösung');
    const captured = Promise.withResolvers(),
      gate = Promise.withResolvers(),
      finished = Promise.withResolvers();
    await p.route(
      '**/rest/v1/rpc/save_profile',
      async (route) => {
        try {
          const response = await route.fetch();
          assert.equal((await response.json()).ok, true);
          captured.resolve();
          await gate.promise;
          await route.fulfill({ response }).catch(() => {
            /* Logout bricht die Zustellung ab. */
          });
        } catch (error) {
          captured.reject(error);
        } finally {
          finished.resolve();
        }
      },
      { times: 1 },
    );
    await button(p, 'Namen speichern').click();
    try {
      await Promise.race([
        captured.promise,
        wait(8000).then(() => {
          throw new Error('Mutation fehlt');
        }),
      ]);
      await signOut(p);
      await link(p, 'Anmelden').click();
      await fillAuthEmail(p, 'Anmelden', address('Dani'));
      await p.getByLabel('Passwort', { exact: true }).fill(password);
      await button(p, 'Anmelden').click();
      await heading(p, 'Dein Haushalt');
    } finally {
      gate.resolve();
    }
    await finished.promise;
    await p.getByText('Anzeigenamen bearbeiten', { exact: true }).click();
    assert.equal(
      await p.getByLabel('Anzeigename', { exact: true }).inputValue(),
      'Dani',
    );
    assert.equal(
      await p.getByText('Dein Anzeigename ist gespeichert.').count(),
      0,
    );
    assert.equal(new URL(p.url()).pathname, '/');
  });
  await step(
    'PKCE – vertauschte Callback-Routen, fehlender Verifier und verbrauchter Link',
    async () => {
      for (const recovery of [false, true]) {
        const p = await page();
        const email = address(recovery ? 'Anna' : 'Callback');
        await p.goto(
          origin + (recovery ? '/auth/forgot-password' : '/auth/register'),
        );
        await fillAuthEmail(
          p,
          recovery ? 'Passwort vergessen?' : 'Konto erstellen',
          email,
        );
        if (!recovery)
          await p.getByLabel('Passwort', { exact: true }).fill(password);
        await button(
          p,
          recovery ? 'Link anfordern' : 'Konto erstellen',
        ).click();
        if (recovery) await p.getByText(/Falls ein Konto/).waitFor();
        else await heading(p, 'E-Mail bestätigen');
        const url = await mailLink(email, recovery ? 'recovery' : 'signup');
        const response = await fetch(url, { redirect: 'manual' });
        const callback = new URL(response.headers.get('location'));
        assert.equal(callback.origin, origin);
        assert.equal(
          callback.pathname,
          recovery ? '/auth/reset-password' : '/auth/callback',
        );
        assert.ok(callback.searchParams.get('code'));
        const invalid = async (tab, url) => {
          await tab.goto(url);
          await heading(tab, 'Link nicht mehr gültig');
          assert.equal(
            await tab.getByLabel('Neues Passwort', { exact: true }).count(),
            0,
          );
          assert.equal(new URL(tab.url()).search + new URL(tab.url()).hash, '');
        };
        const fresh = await page();
        await invalid(fresh, callback.href);
        callback.pathname = recovery
          ? '/auth/callback'
          : '/auth/reset-password';
        // Für die Routenprüfung muss der echte Austausch erfolgreich sein.
        const exchange = p.waitForResponse(
          (r) =>
            r.url().startsWith(api + '/auth/v1/token?grant_type=pkce') &&
            r.request().method() === 'POST',
        );
        await invalid(p, callback.href);
        assert.equal((await exchange).status(), 200);
        await invalid(fresh, url);
      }
    },
  );
  await step('Kontowechsel während einer echten Registrierung', async () => {
    const p = await page();
    await p.goto(origin + '/auth/register');
    const email = address('Kontowechsel');
    await fillAuthEmail(p, 'Konto erstellen', email);
    await p.getByLabel('Passwort', { exact: true }).fill(password);
    const gate = Promise.withResolvers();
    await p.route(
      '**/auth/v1/signup*',
      async (route) => {
        const response = await route.fetch();
        await gate.promise;
        await route.fulfill({ response });
      },
      { times: 1 },
    );
    const completed = p.waitForResponse(
      (r) =>
        r.url().startsWith(api + '/auth/v1/signup') &&
        r.request().method() === 'POST',
    );
    const visited = [];
    p.on('framenavigated', (frame) => {
      if (frame === p.mainFrame()) visited.push(new URL(frame.url()).pathname);
    });
    try {
      await button(p, 'Konto erstellen').click();
      await mailLink(email, 'signup');
      const secondTab = await p.context().newPage();
      await login(secondTab, 'Dani');
      await heading(p, 'Dein Haushalt');
    } finally {
      gate.resolve();
    }
    assert.equal((await completed).status(), 200);
    await p.getByText('Anzeigenamen bearbeiten', { exact: true }).click();
    assert.equal(
      await p.getByLabel('Anzeigename', { exact: true }).inputValue(),
      'Dani',
    );
    assert.ok(!visited.includes('/auth/confirm'));
  });
} catch (error) {
  // Playwright-Fehler können URLs und Eingabewerte enthalten. Nur sichere Diagnose ausgeben.
  const lines = [
    ...String(error.stack).matchAll(/browser\.mjs:(\d+):\d+/g),
  ].map((m) => m[1]);
  console.error(
    'FAIL ' +
      stage +
      ' (' +
      error.name +
      ', Testzeilen ' +
      lines.join(', ') +
      ')',
  );
  process.exitCode = 1;
} finally {
  await browser?.close();
  await server?.close();
  localStatus();
  checkBindings();
  const ids =
    "select id from auth.users where email like 'task006-" +
    run +
    "-%@example.invalid'";
  sql(
    'begin; delete from public.households where owner_id in (' +
      ids +
      '); delete from auth.users where id in (' +
      ids +
      '); commit;',
  );
  for (const id of messages) {
    const r = await fetch(mail + '/api/v1/messages', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ IDs: [id] }),
    });
    assert.ok(r.ok);
  }
  assert.equal(sql('select count(*) from (' + ids + ') u'), '0');
  console.log('Testkonten bereinigt.');
}
