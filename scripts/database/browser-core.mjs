/* global document -- Playwright-Browserkontext. */
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { sql } from './local.mjs';

export async function coreInventory({ a, b, step, layout, origin }) {
  const go = (page, path) => page.goto(origin + path);
  const button = (p, name) => p.getByRole('button', { name, exact: true });
  const link = (p, name) => p.getByRole('link', { name, exact: true });
  const heading = (p, name) =>
    p.getByRole('heading', { name, exact: true }).waitFor();
  const label = (p, name) => p.getByLabel(name, { exact: true });
  const save = (p) => button(p, 'Zum Vorrat hinzufügen').click();
  const household = await a.evaluate(
    async () =>
      (await import('/src/features/auth/session.ts')).activeScope().household,
  );
  assert.match(household, /^[\da-f-]{36}$/);
  const where = "household_id='" + household + "'";
  const localDate = (offset) =>
    sql(
      "select ((now() at time zone 'Europe/Zurich')::date + " +
        offset +
        ')::text',
    );
  const screenshot = async (p, name) => {
    if (process.env.ZAEME_SCREENSHOTS !== '1') return;
    await mkdir('docs/review/task008', { recursive: true });
    await p.screenshot({ path: 'docs/review/task008/' + name + '.png' });
  };
  const count = () =>
    Number(sql('select count(*) from public.inventory_items where ' + where));
  let id;
  const stored = () =>
    JSON.parse(
      sql(
        "select row_to_json(i) from public.inventory_items i where id='" +
          id +
          "'",
      ),
    );
  const detail = (p, suffix = '') => go(p, '/inventory/' + id + suffix);
  async function capture(p, name, amount, date, type = 'MHD') {
    await go(p, '/capture/manual');
    await label(p, 'Produktname').fill(name);
    await label(p, 'Menge').fill(amount);
    if (date) {
      await label(p, 'Haltbarkeitsdatum (optional)').fill(date);
      await label(p, 'Datumsart').selectOption(type);
    }
    await save(p);
    await heading(p, 'Lebensmittel hinzugefügt');
  }
  await step('008 A · Leerer Vorrat und fünf Navigationsaktionen', async () => {
    await go(a, '/');
    await a.getByText('Euer Vorrat ist noch leer.').waitFor();
    assert.deepEqual(
      await a.getByRole('navigation').locator('a,button').allTextContents(),
      ['Start', 'Vorrat', 'Hinzufügen', 'Einkauf', 'Haushalt'],
    );
    await screenshot(a, 'leer');
    await layout(a);
    await link(a, 'Einkauf').click();
    await a.getByText(/Einkaufsliste ist noch nicht/).waitFor();
    await button(a, 'Hinzufügen').click();
    await heading(a, 'Lebensmittel hinzufügen');
    assert.equal(await a.locator('nav [aria-current]').count(), 0);
    await button(a, 'Abbrechen').click();
    await heading(a, 'Einkauf');
    await a.waitForFunction(() => document.activeElement.id === 'nav-add');
    await link(a, 'Haushalt').click();
    await heading(a, 'WG A');
    await screenshot(a, 'haushalt');
  });
  await step('008 B · Validierung und Erfassung ohne Datum', async () => {
    await button(a, 'Hinzufügen').click();
    await heading(a, 'Lebensmittel hinzufügen');
    await screenshot(a, 'erfassung');
    await layout(a);
    await label(a, 'Menge').fill('1,5');
    await label(a, 'Barcode (EAN-13) (optional)').fill('123');
    await save(a);
    await a.getByText(/Gib einen Produktnamen/).waitFor();
    await a.getByText(/nur ganze Mengen/).waitFor();
    await a.getByText(/gültiger EAN/).waitFor();
    await label(a, 'Einheit').selectOption('kg');
    await label(a, 'Kategorie').selectOption('Getränke');
    await a.getByText(/passende Einheit/).waitFor();
    assert.equal(count(), 0);
    await capture(a, 'Haferflocken', '6');
    await a.getByText('Haferflocken wurde zum Vorrat hinzugefügt.').waitFor();
    id = sql(
      'select id from public.inventory_items where ' +
        where +
        " and name='Haferflocken'",
    );
    assert.match(id, /^[a-f0-9-]{36}$/);
    assert.equal(stored().quantity, 6);
    assert.equal(stored().expiry_date, null);
    assert.equal(stored().date_type, null);
    await link(a, 'Zum Vorrat').click();
    await a.getByText('Kein Datum erfasst').waitFor();
  });
  await step(
    '008 C · Separate Chargen und globale Ablaufreihenfolge',
    async () => {
      await capture(a, 'Joghurt', '2', localDate(-1), 'Verbrauchsdatum');
      await capture(a, 'Joghurt', '3', localDate(0));
      await capture(a, 'Birnen', '2', localDate(3));
      await capture(a, 'Reis', '1', localDate(15));
      await go(a, '/');
      await a.locator('.stock-list li').nth(2).waitFor();
      assert.deepEqual(
        await a.locator('.stock-list strong').allTextContents(),
        ['Joghurt', 'Joghurt', 'Birnen'],
      );
      await screenshot(a, 'start');
      await link(a, 'Alle Ablaufhinweise anzeigen').click();
      await heading(a, 'Vorrat');
      assert.equal(
        await button(a, 'Ablaufhinweise').getAttribute('aria-pressed'),
        'true',
      );
      await a.locator('.stock-list li').nth(2).waitFor();
      assert.equal(await a.locator('.stock-list li').count(), 3);
      await button(a, 'Alle').click();
      await label(a, 'Produktname suchen').fill('JOG');
      assert.equal(await a.locator('.stock-list li').count(), 2);
      await a.locator('.stock-list a').first().click();
      await link(a, 'Aus Bestand entfernen').waitFor();
      await link(a, 'Zurück zum Vorrat').click();
      assert.equal(await label(a, 'Produktname suchen').inputValue(), 'JOG');
      await button(a, 'Suche und Filter zurücksetzen').click();
      await screenshot(a, 'vorrat');
      await layout(a);
      for (const width of [320, 1280]) {
        await a.setViewportSize({ width, height: 844 });
        await screenshot(a, 'vorrat-' + width);
      }
      await a.setViewportSize({ width: 390, height: 844 });
    },
  );
  await step('008 D · Bearbeiten und konkurrierende Version', async () => {
    await detail(a, '/edit');
    await label(a, 'Produktname').fill('Haferflocken fein');
    await screenshot(a, 'bearbeiten');
    await layout(a);
    await detail(b, '/edit');
    await label(b, 'Lagerort (optional)').selectOption('Vorratsschrank');
    await button(b, 'Änderungen speichern').click();
    await link(b, 'Bearbeiten').waitFor();
    await button(a, 'Änderungen speichern').click();
    await button(a, 'Aktuellen Stand als Grundlage übernehmen').waitFor();
    await screenshot(a, 'konflikt');
    assert.equal(stored().name, 'Haferflocken');
    await button(a, 'Aktuellen Stand als Grundlage übernehmen').click();
    await button(a, 'Änderungen speichern').click();
    await heading(a, 'Haferflocken fein');
    assert.equal(stored().version, 3);
    assert.equal(stored().location, 'Vorratsschrank');
  });
  async function reserve(p, n) {
    await detail(p, '/reserve');
    await label(p, 'Gewünschte eigene Menge (Stück)').fill(n);
    await button(p, 'Reservierung speichern').click();
    await heading(p, 'Haferflocken fein');
  }
  await step('008 E · Eigene und fremde Reservierungen', async () => {
    await reserve(b, '2');
    await reserve(a, '1');
    await reserve(a, '2');
    await a.getByText('Bea · 2 Stück').waitFor();
    await screenshot(a, 'detail');
    await a.getByText('Bea · 2 Stück').scrollIntoViewIfNeeded();
    await screenshot(a, 'detail-reservierungen');
    await layout(a);
    assert.equal(stored().quantity, 6);
    assert.equal(
      sql(
        "select sum(quantity) from public.reservations where inventory_item_id='" +
          id +
          "'",
      ),
      '4',
    );
    await detail(a, '/reserve');
    await label(a, 'Gewünschte eigene Menge (Stück)').waitFor();
    await screenshot(a, 'reservieren');
    await button(a, 'Reservierung freigeben').click();
    await heading(a, 'Haferflocken fein');
    assert.equal(
      sql(
        "select sum(quantity) from public.reservations where inventory_item_id='" +
          id +
          "'",
      ),
      '2',
    );
    await detail(a, '/edit');
    await heading(a, 'Lebensmittel bearbeiten');
    assert.ok(await button(a, 'Eintrag löschen').isDisabled());
    await detail(a, '/consume');
    await label(a, 'Menge (Stück)').fill('5');
    await button(a, 'Verbrauchen').click();
    await a.getByText(/reicht der für dich/).waitFor();
    assert.equal(stored().quantity, 6);
    await label(a, 'Menge (Stück)').fill('2');
    await button(a, 'Verbrauchen').click();
    await heading(a, 'Haferflocken fein');
    assert.equal(stored().quantity, 4);
    await detail(b, '/reserve');
    await button(b, 'Reservierung freigeben').click();
    await heading(b, 'Haferflocken fein');
  });
  await step(
    '008 F · Vollverbrauch, Abbruch und veraltete Bestätigung',
    async () => {
      await detail(a, '/consume');
      await button(a, 'Gesamten Bestand entfernen').click();
      await screenshot(a, 'vollverbrauch');
      await button(a, 'Abbrechen').click();
      assert.equal(stored().quantity, 4);
      await button(a, 'Gesamten Bestand entfernen').click();
      await detail(b, '/edit');
      await label(b, 'Menge').fill('3');
      await button(b, 'Änderungen speichern').click();
      await heading(b, 'Haferflocken fein');
      await button(a, 'Vollständig entfernen').click();
      await a.getByText('3 Stück', { exact: true }).first().waitFor();
      assert.equal(stored().quantity, 3);
      await button(a, 'Gesamten Bestand entfernen').click();
      await button(a, 'Vollständig entfernen').click();
      await heading(a, 'Vorrat');
      assert.equal(stored().status, 'consumed');
      await detail(a);
      await heading(a, 'Eintrag nicht verfügbar');
    },
  );
  await step(
    '008 G · Verlorene Anlageantwort und identische Wiederholung',
    async () => {
      await go(a, '/capture/manual');
      await label(a, 'Produktname').fill('Linsen');
      let original;
      await a.route(
        '**/rpc/create_item',
        async (r) => {
          original = r.request().postData();
          const resp = await r.fetch();
          assert.equal((await resp.json()).ok, true);
          await r.abort('failed');
        },
        { times: 1 },
      );
      await save(a);
      await button(a, 'Ursprüngliche Anfrage identisch wiederholen').waitFor();
      await label(a, 'Produktname').fill('Zweite Absicht');
      assert.ok(await button(a, 'Zum Vorrat hinzufügen').isDisabled());
      await link(a, 'Vorrat').click();
      await button(a, 'Aktuellen Vorrat abgleichen').click();
      await button(a, 'Geprüfte Anfrage abschliessen').waitFor();
      const req = a.waitForRequest((r) => r.url().endsWith('/rpc/create_item'));
      await button(a, 'Ursprüngliche Anfrage identisch wiederholen').click();
      assert.equal((await req).postData(), original);
      await a.getByText('Linsen wurde zum Vorrat hinzugefügt.').waitFor();
      assert.equal(
        sql(
          'select count(*) from public.inventory_items where ' +
            where +
            " and name='Linsen'",
        ),
        '1',
      );
    },
  );
  await step(
    '008 H · Offline, Wiederverbindung und fehlerhaften Eintrag löschen',
    async () => {
      await go(a, '/inventory');
      await a.locator('.stock-list strong').first().waitFor();
      await a.context().setOffline(true);
      await a.getByText(/Angezeigte Daten können veraltet/).waitFor();
      assert.ok((await a.locator('.stock-list strong').count()) > 0);
      await a.context().setOffline(false);
      await go(a, '/capture/manual');
      await label(a, 'Produktname').fill('Testcharge');
      await a.context().setOffline(true);
      await a.getByText(/Angezeigte Daten können veraltet/).waitFor();
      assert.ok(await button(a, 'Zum Vorrat hinzufügen').isDisabled());
      await a.context().setOffline(false);
      assert.equal(await label(a, 'Produktname').inputValue(), 'Testcharge');
      await save(a);
      await heading(a, 'Lebensmittel hinzugefügt');
      id = sql(
        'select id from public.inventory_items where ' +
          where +
          " and name='Testcharge'",
      );
      await detail(a, '/edit');
      await button(a, 'Eintrag löschen').click();
      await button(a, 'Abbrechen').last().click();
      assert.equal(stored().name, 'Testcharge');
      await button(a, 'Eintrag löschen').click();
      await button(a, 'Endgültig löschen').click();
      await heading(a, 'Vorrat');
      assert.equal(
        sql(
          "select count(*) from public.inventory_items where id='" + id + "'",
        ),
        '0',
      );
    },
  );
  await step(
    '008 I · Mehrseitiger Vorrat mit 200 und 1005 zusätzlichen Chargen',
    async () => {
      for (const [start, end] of [
        [1, 200],
        [201, 1005],
      ]) {
        sql(
          "insert into public.inventory_items(household_id,name,quantity,unit,category) select '" +
            household +
            "','Prüfcharge '||n,1,'Stück','Sonstiges' from generate_series(" +
            start +
            ',' +
            end +
            ') n',
        );
        if (end === 1005)
          sql(
            "update public.inventory_items set expiry_date='2000-01-01',date_type='MHD' where id=(select id from public.inventory_items where " +
              where +
              " and name like 'Prüfcharge %' order by id desc limit 1)",
          );
        const mark = performance.now();
        await go(a, '/inventory');
        await a.locator('.stock-list a').first().waitFor();
        const elapsed = Math.round(performance.now() - mark);
        const active = sql(
          'select count(*) from public.inventory_items where ' +
            where +
            " and status='active'",
        );
        console.log(
          'Vorrat ' +
            active +
            ' aktive Chargen · Navigation bis erste Zeile ' +
            elapsed +
            ' ms',
        );
        await label(a, 'Produktname suchen').fill('Prüfcharge ' + end);
        await a
          .locator('.stock-list strong', { hasText: 'Prüfcharge ' + end })
          .waitFor();
      }
      await go(a, '/');
      await a.locator('.stock-list strong').first().waitFor();
      assert.match(
        await a.locator('.stock-list strong').first().textContent(),
        /Prüfcharge/,
      );
    },
  );
  // Nur Chargen im eigens für diesen Browserlauf erzeugten Testhaushalt.
  sql('delete from public.inventory_items where ' + where);
  await go(a, '/household');
  await heading(a, 'WG A');
  await go(b, '/household');
  await heading(b, 'WG A');
}
