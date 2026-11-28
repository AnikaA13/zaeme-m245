import assert from 'node:assert/strict';
import { barcode, cameraFixture } from './camera-fixture.mjs';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const fixture = await cameraFixture();
let server, browser;
try {
  server = await createServer({
    server: { host: '127.0.0.1', port: 5210, strictPort: true, open: false },
    logLevel: 'error',
  });
  await server.listen();
  browser = await chromium.launch({
    args: ['--use-fake-ui-for-media-stream', ...fixture.args],
  });
  const page = await browser.newPage();
  let calls = 0;
  await page.route('**/api/product?ean=*', (route) => {
    calls++;
    assert.equal(route.request().method(), 'GET');
    assert.equal(
      route.request().url(),
      'http://127.0.0.1:5210' + '/api/product?ean=' + barcode,
    );
    return route.fulfill(
      calls === 1
        ? {
            json: {
              code: barcode,
              status: 'success',
              result: { id: 'product_found' },
              product: { product_name: 'Testprodukt' },
            },
          }
        : {
            status: 404,
            json: {
              code: barcode,
              status: 'failure',
              result: { id: 'product_not_found' },
            },
          },
    );
  });
  await page.addInitScript(() => {
    // Nur Zustände der Tracks für die Prüfung beobachten.
    const devices = navigator.mediaDevices;
    const get = devices.getUserMedia.bind(devices);
    window.testTracks = [];
    devices.getUserMedia = async (constraints) => {
      const stream = await get(constraints);
      window.testTracks.push(...stream.getTracks());
      return stream;
    };
  });
  await page.goto('http://127.0.0.1:5210/dev/scanner.html');
  assert.equal(await page.evaluate(() => window.isSecureContext), true);
  assert.equal(await page.evaluate(() => window.testTracks.length), 0);
  for (const found of [true, false]) {
    await page.getByRole('button', { name: 'Kamera starten' }).click();
    await page
      .getByText(
        found
          ? 'Produkt gefunden. Bitte prüfe den Namen.'
          : 'Produkt unbekannt. Ergänze den Namen.',
        { exact: true },
      )
      .waitFor();
    assert.equal(
      await page.getByLabel('Barcode', { exact: true }).inputValue(),
      barcode,
    );
    assert.equal(
      await page.getByLabel('Produktname').inputValue(),
      found ? 'Testprodukt' : '',
    );
    assert.equal(
      await page.locator('video').evaluate((v) => v.srcObject),
      null,
    );
    assert.ok(
      await page.evaluate(
        () =>
          window.testTracks.length > 0 &&
          window.testTracks.every((t) => t.readyState === 'ended'),
      ),
    );
    await page.getByLabel('Produktname').fill('Von Hand ergänzt');
  }
  assert.equal(calls, 2);
  console.log(
    'Chromium ' +
      browser.version() +
      ': 2 optische Lesungen derselben Y4M-Fixture, je 1 Lookup (HTTP simuliert), führende Nullen und beendete Tracks geprüft.',
  );
} finally {
  try {
    await browser?.close();
  } finally {
    try {
      await server?.close();
    } finally {
      await fixture.close();
    }
  }
}
