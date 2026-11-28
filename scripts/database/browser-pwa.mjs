/* global caches, indexedDB -- Chromium-Prüfkontext */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { chromium } from 'playwright';
import { build, preview } from 'vite';
import { apiFixture } from './api-fixture.mjs';
import { operationId } from './fixtures.mjs';
import { api, browserPort, localStatus } from './local.mjs';

test('011B · Produktionsbuild, private Sitzung, Offline-Start und Workerwechsel', async (t) => {
  const f = apiFixture(t);
  const user = await f.profiled('PWA-Test');
  f.success(
    await f.rpc(user, 'create_household', {
      op: operationId(),
      name: 'PWA-Prüfhaushalt',
    }),
  );
  const options = localStatus();
  process.env.VITE_SUPABASE_URL = api;
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY =
    options.PUBLISHABLE_KEY || f.guest;
  await mkdir('test-results', { recursive: true });
  const outDir = await mkdtemp(resolve('test-results/pwa-'));
  await build({ build: { outDir }, logLevel: 'error' });
  const server = await preview({
    build: { outDir },
    preview: {
      host: '127.0.0.1',
      port: browserPort,
      strictPort: true,
      open: false,
    },
  });
  t.after(() => server.close());
  const browser = await chromium.launch();
  t.after(() => browser.close());
  const page = await browser.newPage();
  const origin = 'http://127.0.0.1:' + browserPort;
  const scripts = [];
  page.on('request', (r) => {
    if (r.resourceType() === 'script') scripts.push(new URL(r.url()).pathname);
  });
  await page.goto(origin);
  await page
    .getByRole('heading', { name: 'Gemeinsam alles im Blick.' })
    .waitFor();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  assert.equal(scripts.filter((s) => s.startsWith('/assets/')).length, 1);
  const cdp = await page.context().newCDPSession(page);
  const app = await cdp.send('Page.getAppManifest');
  assert.deepEqual(app.errors, []);
  const manifest = JSON.parse(app.data);
  for (const [key, value] of Object.entries({
    id: '/',
    name: 'zäme',
    short_name: 'zäme',
    lang: 'de-CH',
    scope: '/',
    start_url: '/',
    display: 'standalone',
    theme_color: '#1C1840',
    background_color: '#FBF9F1',
  }))
    assert.equal(manifest[key], value);
  assert.deepEqual(
    manifest.icons.map((i) => [i.sizes, i.purpose]),
    [
      ['192x192', 'any'],
      ['512x512', 'any'],
      ['512x512', 'maskable'],
    ],
  );
  for (const icon of [
    ...manifest.icons,
    { src: '/icons/zaeme-180.png', sizes: '180x180' },
  ]) {
    const response = await page.request.get(origin + icon.src);
    assert.equal(response.status(), 200);
    assert.match(response.headers()['content-type'], /image\/png/);
    const bytes = await response.body();
    assert.equal(
      bytes.readUInt32BE(16) + 'x' + bytes.readUInt32BE(20),
      icon.sizes,
    );
  }
  await page.goto(origin + '/auth/login');
  await page.getByLabel('E-Mail-Adresse').fill(user.email);
  await page.getByLabel('Passwort', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
  await page
    .getByRole('heading', { name: 'Haltbarkeitsdaten prüfen' })
    .waitFor();
  await page.goto(origin + '/capture/manual');
  await page.getByLabel('Produktname', { exact: true }).fill('PWA-Prüfcharge');
  await page.getByRole('button', { name: 'Zum Vorrat hinzufügen' }).click();
  await page
    .getByRole('heading', { name: 'Lebensmittel hinzugefügt' })
    .waitFor();
  await page.goto(origin + '/inventory');
  await page.getByText('PWA-Prüfcharge', { exact: true }).waitFor();
  await page.goto(origin + '/shopping');
  await page.getByText('Keine offenen Einkaufseinträge.').waitFor();
  await page.goto(origin + '/household');
  const guide = page.getByText('zäme installieren', { exact: true });
  await guide.focus();
  await page.keyboard.press('Enter');
  await page.getByText(/iPhone mit Safari/).waitFor();
  await page.keyboard.press('Tab');
  assert.equal(
    await page.evaluate(() => {
      const el = globalThis.document.activeElement;
      return (
        el.matches(':focus-visible') &&
        globalThis.getComputedStyle(el).outlineStyle !== 'none'
      );
    }),
    true,
  );
  await page.setViewportSize({ width: 320, height: 640 });
  await page.evaluate(() => {
    globalThis.document.documentElement.style.fontSize = '200%';
    globalThis.scrollTo(0, globalThis.document.documentElement.scrollHeight);
  });
  const nav = await page.getByRole('navigation').boundingBox();
  const last = await page
    .getByRole('button', { name: 'Abmelden' })
    .boundingBox();
  assert.ok(
    last && nav && last.y + last.height <= nav.y,
    'Abmelden muss oberhalb der Navigation erreichbar sein',
  );
  const storage = () =>
    page.evaluate(async () => ({
      caches: await caches.keys(),
      dbs: (await indexedDB.databases()).map((db) => db.name),
    }));
  assert.deepEqual(await storage(), { caches: [], dbs: [] });
  await page.evaluate(async () => {
    await caches.open('anderer-test');
    await caches.open('zaeme-public-shell-veraltet');
  });
  const worker = join(outDir, 'sw.js');
  const firstController = await page.evaluateHandle(
    () => navigator.serviceWorker.controller,
  );
  const nextSource =
    (await readFile(worker, 'utf8')) + '\n// Zweite Testrevision.\n';
  await writeFile(worker, nextSource);
  assert.equal(
    await (await page.request.get(origin + '/sw.js')).text(),
    nextSource,
  );
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    await registration.update();
  });
  await page.waitForFunction(
    (previous) => {
      const current = navigator.serviceWorker.controller;
      return current && current !== previous && current.state === 'activated';
    },
    firstController,
    { timeout: 20000 },
  );
  await firstController.dispose();
  assert.deepEqual(await storage(), { caches: ['anderer-test'], dbs: [] });
  await page.context().setOffline(true);
  const offline = await page.goto(origin + '/inventory');
  assert.equal(offline.status(), 503);
  await page
    .getByRole('heading', { name: 'Keine Netzwerkverbindung' })
    .waitFor();
  assert.equal(await page.getByText('PWA-Prüfcharge').count(), 0);
  await page.context().setOffline(false);
  await page.getByRole('link', { name: 'Erneut öffnen' }).click();
  await page.getByRole('link', { name: 'Vorrat', exact: true }).click();
  await page.getByText('PWA-Prüfcharge', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Abmelden' }).click();
  await page.getByText('Du bist auf diesem Gerät abgemeldet.').waitFor();
  await page.goto(origin + '/inventory');
  await page
    .getByRole('heading', { name: 'Gemeinsam alles im Blick.', exact: true })
    .waitFor();
  assert.deepEqual(await storage(), { caches: ['anderer-test'], dbs: [] });
});
