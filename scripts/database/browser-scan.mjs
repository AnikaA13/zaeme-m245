/* global document, window -- Beobachtung im Chromium-Testkontext. */
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { barcode } from '../scanner/camera-fixture.mjs';
import { sql } from './local.mjs';

export async function scanCapture({ page, step, layout, origin, signOut }) {
  const button = (name) => page.getByRole('button', { name, exact: true });
  const name = page.getByLabel('Produktname', { exact: true });
  const ean = page.getByLabel('Barcode (EAN-13) (optional)');
  const scan = () => button('Lebensmittel scannen').click();
  const start = () => button('Kamera starten').click();
  const cancel = () => button('Abbrechen').click();
  const manual = () => button('Manuell hinzufügen').click();
  const stopped = () =>
    page.evaluate(
      () =>
        window.scanTracks.length > 0 &&
        window.scanTracks.every((t) => t.readyState === 'ended'),
    );
  const screenshot = async (file) => {
    if (process.env.ZAEME_SCAN_SCREENSHOTS !== '1') return;
    const dir =
      process.env.ZAEME_RELEASE_REVIEW === '1'
        ? 'docs/review/task011b/task010b'
        : 'docs/review/task010b';
    await mkdir(dir, { recursive: true });
    const original = page.viewportSize();
    const form = ['produktpruefung', 'unbekannt'].includes(file);
    if (form) await page.setViewportSize({ width: 390, height: 1180 });
    try {
      await page.screenshot({ path: dir + '/' + file + '.png' });
    } finally {
      if (form && original) await page.setViewportSize(original);
    }
  };
  const household = await page.evaluate(
    async () =>
      (await import('/src/features/auth/session.ts')).activeScope().household,
  );
  assert.match(household, /^[a-f0-9-]{36}$/);
  const where =
    "household_id='" + household + "' and barcode='" + barcode + "'";
  const rows = () =>
    JSON.parse(
      sql(
        "select coalesce(json_agg(i order by name),'[]') from public.inventory_items i where " +
          where,
      ),
    );
  assert.equal(rows().length, 0);
  let outcome = 'found',
    lookups = 0;
  const ops = [];
  page.on('request', (req) => {
    if (req.url().endsWith('/rpc/create_item') && req.method() === 'POST')
      ops.push(req.postDataJSON().op);
  });
  let held;
  await page.route('**/api/product?ean=*', async (route) => {
    const request = route.request();
    assert.equal(request.method(), 'GET');
    assert.equal(request.url(), origin + '/api/product?ean=' + barcode);
    const headers = await request.allHeaders();
    for (const key of ['authorization', 'apikey', 'cookie', 'referer'])
      assert.equal(headers[key], undefined);
    lookups++;
    if (outcome === 'hold') {
      held = route;
      return;
    }
    if (outcome === 'failed') return route.abort('internetdisconnected');
    if (outcome === 'unknown')
      return route.fulfill({
        status: 404,
        json: {
          code: barcode,
          status: 'failure',
          result: { id: 'product_not_found' },
        },
      });
    return route.fulfill({
      json: {
        code: barcode,
        status: 'success',
        result: { id: 'product_found' },
        product: { product_name_de: 'Haferdrink' },
      },
    });
  });
  const cdp = await page.context().newCDPSession(page);
  const { targetInfo } = await cdp.send('Target.getTargetInfo');
  const cameraPermission = (setting) =>
    cdp.send('Browser.setPermission', {
      permission: { name: 'camera' },
      setting,
      origin,
      browserContextId: targetInfo.browserContextId,
    });
  await page.addInitScript(() => {
    window.scanTracks = [];
    window.scanStarts = 0;
    const devices = navigator.mediaDevices;
    const get = devices.getUserMedia.bind(devices);
    devices.getUserMedia = async (constraints) => {
      window.scanStarts++;
      const stream = await get(constraints);
      window.scanTracks.push(...stream.getTracks());
      if (window.delayScanGrant)
        await new Promise((resolve) => {
          window.releaseScanGrant = resolve;
        });
      return stream;
    };
  });
  await cameraPermission('granted');
  await page.reload();
  await page
    .getByRole('heading', { name: 'Haltbarkeitsdaten prüfen' })
    .waitFor();
  await step(
    '010B A · Herkunft, Freigabe und verspäteter Kamerastart',
    async () => {
      await page.getByRole('link', { name: 'Einkauf', exact: true }).click();
      await button('Hinzufügen').click();
      await screenshot('auswahl');
      await scan();
      await layout(page);
      assert.equal(await page.evaluate(() => window.scanStarts), 0);
      await cancel();
      await page.waitForFunction(
        () =>
          document.activeElement.id === 'nav-add' &&
          window.location.pathname === '/shopping',
      );
      await page.getByRole('link', { name: 'Start', exact: true }).click();
      await scan();
      await page.evaluate(() => {
        window.delayScanGrant = true;
      });
      await start();
      await page.waitForFunction(() => !!window.releaseScanGrant);
      await cancel();
      await page.evaluate(() => {
        window.delayScanGrant = false;
        window.releaseScanGrant();
      });
      await page.waitForFunction(
        () =>
          document.activeElement.id === 'scan-add' &&
          window.scanTracks.every((t) => t.readyState === 'ended'),
      );
      assert.equal(lookups, 0);
    },
  );
  await step(
    '010B B · Kamerazugriff verweigert und manuelle Erfassung',
    async () => {
      await cameraPermission('denied');
      await scan();
      await start();
      await page.getByText(/Die Kamera ist gesperrt/).waitFor();
      await screenshot('kamera-gesperrt');
      await manual();
      assert.equal(await ean.inputValue(), '');
      await cancel();
      await cameraPermission('granted');
    },
  );
  await step(
    '010B C · Optischer Treffer, Korrektur, Doppelklick und Quittung',
    async () => {
      await scan();
      await start();
      await page
        .getByText('Halte den Barcode mit senkrechten Strichen in den Rahmen.')
        .waitFor();
      await screenshot('kamera-fixture');
      await page.getByText(/Produkt erkannt\./).waitFor();
      assert.ok(await stopped());
      assert.equal(lookups, 1);
      assert.equal(await name.inputValue(), 'Haferdrink');
      assert.equal(await ean.inputValue(), barcode);
      assert.equal(
        await page.getByLabel('Menge', { exact: true }).inputValue(),
        '1',
      );
      assert.equal(await page.getByLabel('Einheit').inputValue(), 'Stück');
      assert.equal(
        await page.getByLabel('Kategorie').inputValue(),
        'Sonstiges',
      );
      assert.equal(
        await page.getByLabel('Haltbarkeitsdatum (optional)').inputValue(),
        '',
      );
      assert.equal(await page.getByLabel('Datumsart').count(), 0);
      assert.equal(ops.length, 0);
      assert.equal(rows().length, 0);
      await screenshot('produktpruefung');
      await name.fill('Haferdrink nature');
      const save = button('Zum Vorrat hinzufügen');
      await save.evaluate((el) => {
        el.click();
        el.click();
      });
      await button('Weiter scannen').waitFor();
      assert.equal(ops.length, 1);
      const [item] = rows();
      assert.equal(rows().length, 1);
      assert.equal(item.name, 'Haferdrink nature');
      assert.equal(item.expiry_date, null);
      assert.equal(item.date_type, null);
      assert.equal(item.quantity, 1);
      await screenshot('gespeichert');
    },
  );
  await step(
    '010B D · Neuer Scan, unbekanntes Produkt und verlorene Speicherantwort',
    async () => {
      await button('Weiter scannen').click();
      assert.equal(
        await page
          .getByText('Haferdrink nature wurde zum Vorrat hinzugefügt.')
          .count(),
        0,
      );
      outcome = 'unknown';
      await start();
      await page.getByText(/Produkt nicht gefunden/).waitFor();
      assert.equal(lookups, 2);
      assert.equal(await ean.inputValue(), barcode);
      assert.equal(await name.inputValue(), '');
      await screenshot('unbekannt');
      await name.fill('Zweite Packung');
      await page.route(
        '**/rpc/create_item',
        async (route) => {
          const response = await route.fetch();
          assert.equal((await response.json()).ok, true);
          await route.abort('failed');
        },
        { times: 1 },
      );
      await button('Zum Vorrat hinzufügen').click();
      await button('Ursprüngliche Anfrage identisch wiederholen').waitFor();
      assert.ok(await button('Zum Vorrat hinzufügen').isDisabled());
      assert.equal(await button('Weiter scannen').count(), 0);
      await button('Ursprüngliche Anfrage identisch wiederholen').click();
      await button('Weiter scannen').waitFor();
      assert.equal(ops.length, 3);
      assert.notEqual(ops[0], ops[1]);
      assert.equal(ops[1], ops[2]);
      assert.equal(rows().length, 2);
      await button('Weiteres Lebensmittel hinzufügen').click();
      assert.equal(await name.inputValue(), '');
      assert.equal(await ean.inputValue(), '');
      await cancel();
    },
  );
  await step(
    '010B E · Netzfehler, Zeitlimit und bewusster Suchabbruch',
    async () => {
      for (const mode of ['failed', 'timeout', 'manual']) {
        outcome = mode === 'failed' ? 'failed' : 'hold';
        await scan();
        await start();
        if (mode === 'manual') {
          await button('Suche abbrechen und manuell ergänzen').click();
          await page
            .getByText('Barcode erkannt. Ergänze den Produktnamen.')
            .waitFor();
        } else {
          await page
            .getByText(
              mode === 'timeout'
                ? /Antwort hat zu lange gedauert/
                : /Produktinformationen konnten nicht geladen/,
            )
            .waitFor();
        }
        assert.equal(await name.inputValue(), '');
        assert.equal(await ean.inputValue(), barcode);
        await name.fill('Von Hand ergänzt');
        if (held) {
          await held.abort().catch(() => {});
          held = undefined;
        }
        assert.equal(await name.inputValue(), 'Von Hand ergänzt');
        assert.ok(await stopped());
        await cancel();
      }
      assert.equal(rows().length, 2);
    },
  );
  await step(
    '010B F · Routenwechsel mit Kamera und Logout während der Suche',
    async () => {
      await scan();
      await start();
      await page
        .getByText('Halte den Barcode mit senkrechten Strichen in den Rahmen.')
        .waitFor();
      assert.equal(
        await stopped(),
        false,
        'Der Scan verwendet vor dem Seitenwechsel die Kamera',
      );
      await page.getByRole('link', { name: 'Vorrat', exact: true }).click();
      await page
        .getByRole('heading', { name: 'Vorrat', exact: true })
        .waitFor();
      assert.ok(
        await stopped(),
        'Beim sichtbaren Vorrat müssen alle Videospuren beendet sein',
      );
      await button('Hinzufügen').last().click();
      await scan();
      await start();
      await button('Suche abbrechen und manuell ergänzen').waitFor();
      await signOut(page);
      if (held) await held.abort().catch(() => {});
      assert.equal(await name.count(), 0);
      assert.ok(await stopped());
      assert.equal(rows().length, 2);
    },
  );
  // Nur die beiden eigenen synthetischen Chargen für nachfolgende Regressionsfälle entfernen.
  sql('delete from public.inventory_items where ' + where);
}
