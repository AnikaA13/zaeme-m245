import assert from 'node:assert/strict';
import console from 'node:console';
import process from 'node:process';
import { URL } from 'node:url';
import { chromium } from 'playwright';

const input = process.argv[2];
const origin = new URL(input);
const local = origin.hostname === '127.0.0.1' && origin.protocol === 'http:';
assert.ok(
  input === origin.origin,
  'Nur den Ursprung ohne Pfad oder Zugangsdaten angeben.',
);
assert.ok(
  local ||
    (origin.protocol === 'https:' &&
      origin.hostname.endsWith('.vercel.app') &&
      !origin.port),
  'Erwartet wird der geprüfte Vercel-Testursprung oder lokales Loopback.',
);

const routes = [
  ['/', 'Gemeinsam alles im Blick.'],
  ['/join', 'Haushalt beitreten'],
  ['/auth/callback', 'Link nicht mehr gültig'],
  ['/auth/reset-password', 'Link nicht mehr gültig'],
  ['/household', 'Anmelden'],
  ['/household/create', 'Konto erstellen'],
  ['/profile/setup', 'Anmelden'],
  ['/unbekannt-011a', 'Seite nicht gefunden'],
];
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  for (const [path, heading] of routes) {
    const address = new URL(path, origin).href;
    // Auch umgeleitete Einstiege ein zweites Mal direkt beim Host anfordern.
    for (let pass = 0; pass < 2; pass++) {
      const response =
        pass === 1 && page.url() === address
          ? await page.reload()
          : await page.goto(address);
      assert.equal(response.status(), 200, path);
      await page.getByRole('heading', { name: heading, exact: true }).waitFor();
      assert.equal(new URL(page.url()).origin, origin.origin);
    }
    console.log('OK', path);
  }
  await page.getByRole('link', { name: 'Zur Startseite' }).click();
  await page
    .getByRole('heading', { name: 'Gemeinsam alles im Blick.' })
    .waitFor();
  await page.goto(new URL('/auth/reset-password?ungueltig=1', origin).href);
  await page.getByRole('heading', { name: 'Link nicht mehr gültig' }).waitFor();
  assert.equal(page.url(), new URL('/auth/reset-password', origin).href);
  assert.equal(await page.locator('input[type=password]').count(), 0);
  const policy = await page.evaluate(() => ({
    secure: globalThis.isSecureContext,
    cameraApi:
      typeof globalThis.navigator.mediaDevices?.getUserMedia === 'function',
    cameraAllowed: globalThis.document.featurePolicy?.allowsFeature('camera'),
  }));
  assert.equal(policy.secure, true);
  assert.equal(policy.cameraApi, true);
  assert.equal(
    policy.cameraAllowed,
    true,
    'Chromium muss Kamera für dieses Dokument erlauben.',
  );

  const manifest = await page.request.get(
    new URL('/manifest.webmanifest', origin).href,
    { maxRedirects: 0 },
  );
  assert.equal(manifest.status(), 200);
  assert.match(
    manifest.headers()['content-type'] ?? '',
    /application\/(manifest\+json|json)/i,
  );
  const body = await manifest.json();
  assert.equal(body.name, 'zäme');
  assert.equal(body.start_url, '/');
  console.log(
    local
      ? 'Lokale Browserprobe bestanden.'
      : 'Anonyme HTTPS-Browserprobe bestanden.',
  );
} finally {
  await browser.close();
}
