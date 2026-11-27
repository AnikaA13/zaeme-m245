import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { mkdtemp, writeFile, rm, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { createServer } from 'vite';

// EAN-13 mit erster Ziffer 0: alle sechs linken Zeichen verwenden L-Parität.
const barcode = '0034000470693';
const left = [
  '0001101',
  '0011001',
  '0010011',
  '0111101',
  '0100011',
  '0110001',
  '0101111',
  '0111011',
  '0110111',
  '0001011',
];
const right = left.map((pattern) =>
  [...pattern].map((bit) => (bit === '1' ? '0' : '1')).join(''),
);
const bits =
  '101' +
  [...barcode.slice(1, 7)].map((n) => left[n]).join('') +
  '01010' +
  [...barcode.slice(7)].map((n) => right[n]).join('') +
  '101';
const width = 640,
  height = 480;
const frame = Buffer.alloc(width * height * 1.5, 128);
frame.fill(235, 0, width * height);
for (let y = 150; y < 330; y++)
  for (let x = 0; x < bits.length; x++) {
    if (bits[x] === '1')
      frame.fill(16, y * width + 130 + x * 4, y * width + 134 + x * 4);
  }
const dir = await mkdtemp(join(tmpdir(), 'zaeme-ean-'));
const file = join(dir, 'ean.y4m');
let server, browser;
try {
  await writeFile(
    file,
    Buffer.concat([
      Buffer.from('YUV4MPEG2 W640 H480 F10:1 Ip A1:1 C420jpeg\nFRAME\n'),
      frame,
    ]),
  );
  server = await createServer({
    server: { host: '127.0.0.1', port: 5210, strictPort: true, open: false },
    logLevel: 'error',
  });
  await server.listen();
  browser = await chromium.launch({
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      '--use-file-for-fake-video-capture=' + file,
    ],
  });
  const page = await browser.newPage();
  let calls = 0;
  await page.route('https://world.openfoodfacts.org/**', (route) => {
    calls++;
    assert.equal(route.request().method(), 'GET');
    assert.equal(
      route.request().url(),
      'https://world.openfoodfacts.org/api/v3/product/' +
        barcode +
        '.json?fields=product_name_de,product_name',
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
      await rm(file, { force: true });
      await rmdir(dir);
    }
  }
}
