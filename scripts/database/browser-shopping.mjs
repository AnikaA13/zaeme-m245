import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { sql } from './local.mjs';
import { write } from './browser-inventory.mjs';

export async function shoppingSync({
  a,
  b,
  c,
  d,
  origin,
  layout,
  step,
  report = 'messungen',
}) {
  const dir =
    process.env.ZAEME_RELEASE_REVIEW === '1'
      ? 'docs/review/task011b/task009b'
      : process.env.ZAEME_009B_REVIEW === '1'
        ? 'docs/review/task009b'
        : 'test-results/task009b';
  await mkdir(dir, { recursive: true });
  const samples = [];
  const signals = new Map();
  for (const p of [b, c, d]) {
    const received = [];
    signals.set(p, received);
    p.on('websocket', (socket) =>
      socket.on('framereceived', (frame) => {
        try {
          const msg = JSON.parse(frame.payload);
          const payload = Array.isArray(msg) ? msg[4] : msg.payload;
          if (payload?.data?.table === 'household_signals')
            received.push(payload.data.record.id);
        } catch {
          /* Heartbeat und binäre Kontrollrahmen. */
        }
      }),
    );
  }
  const go = (p, path) => p.goto(origin + path);
  const button = (p, name) => p.getByRole('button', { name, exact: true });
  const link = (p, name) => p.getByRole('link', { name, exact: true });
  const row = (p, name) =>
    p
      .locator('.stock-list li')
      .filter({ has: p.getByText(name, { exact: true }) });
  const box = (p, name, checked) =>
    p.getByRole('checkbox', { name, exact: true, checked });
  async function measured(label, writer, rpc, act, visible) {
    const receipt = writer
      .waitForResponse(
        (r) =>
          r.request().method() === 'POST' && r.url().endsWith('/rpc/' + rpc),
      )
      .then(async (r) => {
        const t = performance.now();
        assert.equal((await r.json()).ok, true);
        return t;
      });
    const observed = visible.map((target) =>
      target().then(() => performance.now()),
    );
    const [start, , ends] = await Promise.all([
      receipt,
      act(),
      Promise.all(observed),
    ]);
    for (const end of ends) {
      const ms = Math.ceil(end - start);
      assert.ok(ms >= 0 && ms <= 3000, label + ' · ' + ms + ' ms');
      samples.push({ aktion: label, ms });
    }
  }
  async function ready(p) {
    await p.waitForFunction(async () => {
      const { backend } = await import('/src/lib/supabase/client.ts');
      return (
        backend()
          .getChannels()
          .filter((ch) => ch.state === 'joined').length === 1
      );
    });
    await p
      .getByText('Synchronisation wird aufgebaut …')
      .waitFor({ state: 'hidden' });
  }
  let id, version;
  const product = 'Aprikosen',
    renamed = 'Aprikosen reif',
    wish = 'Aprikosen getrocknet';
  const detail = () => '/inventory/' + id;
  const expiry = sql(
    "select ((now() at time zone 'Europe/Zurich')::date + 5)::text",
  );
  await step(
    '009B · Vorrat, Änderung, Reservierung und Verbrauch',
    async () => {
      await Promise.all([
        go(b, '/inventory'),
        go(c, '/inventory'),
        go(d, '/shopping'),
      ]);
      await Promise.all([ready(b), ready(c), ready(d)]);
      await measured(
        'Vorrat anlegen',
        a,
        'create_item',
        async () => {
          const result = await write(a, 'create_item', {
            fields: {
              name: product,
              quantity: '9',
              expiry_date: expiry,
              date_type: 'MHD',
            },
            ack: false,
          });
          id = result.id;
          version = result.version;
        },
        [b, c].map((p) => () => row(p, product).waitFor()),
      );
      await measured(
        'Vorrat bearbeiten',
        a,
        'edit_item',
        async () => {
          version = (
            await write(a, 'edit_item', {
              id,
              v: version,
              fields: {
                name: renamed,
                quantity: '9',
                unit: 'Stück',
                category: 'Sonstiges',
                location: null,
                barcode: null,
                expiry_date: expiry,
                date_type: 'MHD',
              },
              ack: false,
            })
          ).version;
        },
        [() => row(b, renamed).waitFor()],
      );
      await measured(
        'Teilverbrauch',
        a,
        'consume_item',
        async () => {
          version = (
            await write(a, 'consume_item', {
              id,
              amount: '2',
              unit: 'Stück',
              confirm_full: false,
            })
          ).version;
        },
        [() => row(b, renamed).getByText('7 Stück', { exact: true }).waitFor()],
      );
      await measured(
        'Reservieren',
        a,
        'set_reservation',
        async () => {
          version = (
            await write(a, 'set_reservation', { id, v: version, desired: '3' })
          ).version;
        },
        [
          () =>
            row(b, renamed)
              .getByText(/3 Stück reserviert · 4 Stück frei/)
              .waitFor(),
        ],
      );
      await measured(
        'Reservierung freigeben',
        a,
        'set_reservation',
        async () => {
          version = (
            await write(a, 'set_reservation', { id, v: version, desired: '0' })
          ).version;
        },
        [
          () =>
            row(b, renamed)
              .getByText(/3 Stück reserviert/)
              .waitFor({ state: 'hidden' }),
        ],
      );
    },
  );
  await step('009B · Warnfrist und Ablaufhinweise', async () => {
    await go(a, '/household');
    await go(c, '/household');
    await c.getByText('Warnfrist für Ablaufdaten: 3 Tage').waitFor();
    assert.equal(await button(c, 'Warnfrist bearbeiten').count(), 0);
    const denied = await c.evaluate(async () => {
      const { snapshot } = await import('/src/features/auth/session.ts');
      const { mutate } = await import('/src/lib/operations/rpc.ts');
      const home = snapshot().account.home;
      try {
        await mutate('set_warning_days', {
          h: home.id,
          g: home.g,
          days: 30,
          v: home.version,
        });
      } catch (error) {
        return error.code;
      }
    });
    assert.equal(denied, 'FORBIDDEN');
    for (const days of [0, 7, 30, 3]) {
      await button(a, 'Warnfrist bearbeiten').click();
      await a.getByLabel('Warnfrist in Tagen').fill(String(days));
      const visible = [
        () =>
          c.getByText('Warnfrist für Ablaufdaten: ' + days + ' Tage').waitFor(),
      ];
      if (days === 7 || days === 3)
        visible.push(() =>
          row(b, renamed)
            .locator(days === 7 ? '.expiry.soon' : '.expiry.later')
            .waitFor(),
        );
      await measured(
        'Warnfrist ' + days,
        a,
        'set_warning_days',
        () => button(a, 'Warnfrist speichern').click(),
        visible,
      );
      await button(a, 'Warnfrist bearbeiten').waitFor();
    }
    const profile = await a.evaluate(
      async () =>
        (await import('/src/features/auth/session.ts')).snapshot().account
          .profile,
    );
    const updated = 'Anna Einkauf';
    let profileVersion;
    await measured(
      'Anzeigename',
      a,
      'save_profile',
      async () => {
        profileVersion = (
          await write(a, 'save_profile', { name: updated, v: profile.version })
        ).version;
      },
      [() => c.getByText(updated, { exact: true }).waitFor()],
    );
    await write(a, 'save_profile', {
      name: profile.display_name,
      v: profileVersion,
    });
    await c.getByText(profile.display_name, { exact: true }).waitFor();
    await button(a, 'Warnfrist bearbeiten').click();
    await layout(a);
    await a
      .getByRole('region', { name: 'Warnfrist' })
      .screenshot({ path: dir + '/warnfrist.png' });
    await a
      .getByRole('region', { name: 'Warnfrist' })
      .getByRole('button', { name: 'Abbrechen' })
      .click();
  });
  await step('009B · Einkauf aus dem Detail und gemeinsame Liste', async () => {
    await Promise.all([
      go(a, detail()),
      go(b, '/shopping'),
      go(c, '/shopping'),
    ]);
    await link(a, 'Auf Einkaufsliste setzen').click();
    assert.equal(
      await a.getByLabel('Name', { exact: true }).inputValue(),
      renamed,
    );
    assert.equal(await a.getByLabel('Menge (optional)').inputValue(), '');
    await link(a, 'Abbrechen').click();
    assert.equal(new URL(a.url()).pathname, detail());
    await link(a, 'Auf Einkaufsliste setzen').click();
    await a.getByLabel('Name', { exact: true }).fill(wish);
    await a.getByLabel('Menge (optional)').fill('0,125');
    await button(a, 'Speichern').click();
    await a
      .getByRole('alert')
      .filter({ hasText: 'Menge und Einheit' })
      .waitFor();
    await a.getByLabel('Einheit (optional)').selectOption('kg');
    await measured(
      'Einkauf anlegen',
      a,
      'create_shopping',
      () => button(a, 'Speichern').click(),
      [b, c].map((p) => () => box(p, wish, false).waitFor()),
    );
    await link(a, 'Auf Einkaufsliste setzen').waitFor();
    assert.equal(new URL(a.url()).pathname, detail());
    await link(a, 'Einkauf').click();
    await box(a, wish, false).waitFor();
    const stock = () =>
      sql(
        "select quantity,version from public.inventory_items where id='" +
          id +
          "'",
      );
    const before = stock();
    await measured(
      'Abhaken',
      b,
      'check_shopping',
      () => box(b, wish, false).click(),
      [a, c].map((p) => () => box(p, wish, true).waitFor()),
    );
    await measured(
      'Wieder öffnen',
      c,
      'check_shopping',
      () => box(c, wish, true).click(),
      [a, b].map((p) => () => box(p, wish, false).waitFor()),
    );
    assert.equal(stock(), before);
    const h = await a.evaluate(
      async () =>
        (await import('/src/features/auth/session.ts')).activeScope().household,
    );
    assert.match(h, /^[a-f0-9-]{36}$/);
    let writes = 0;
    const countWrites = (r) => {
      if (r.method() === 'POST' && r.url().includes('/rpc/')) writes++;
    };
    for (const peer of [a, b, c, d]) peer.on('request', countWrites);
    try {
      const observed = [b, c].map((p) =>
        p.waitForResponse(
          (r) => r.url().includes('/household_signals?') && r.status() === 200,
        ),
      );
      sql(
        "update public.household_signals set revision=revision where id='" +
          h +
          "'",
      );
      await Promise.all(observed);
      assert.ok(await box(b, wish, false).isVisible());
      assert.equal(writes, 0);
    } finally {
      for (const peer of [a, b, c, d]) peer.off('request', countWrites);
    }

    await layout(a);
    await a.screenshot({ path: dir + '/einkauf.png', fullPage: true });
    assert.equal(await box(d, wish, false).count(), 0);
    for (const p of [b, c])
      assert.ok(
        signals.get(p).includes(h),
        'Haushalts-UPDATE im WebSocket empfangen',
      );
    assert.ok(!signals.get(d).includes(h), 'Fremdhaushalt bleibt isoliert');
    await link(b, wish + ' bearbeiten').click();
    await b.getByLabel('Name', { exact: true }).fill('Eigener Entwurf');
    await b.evaluate(async () => {
      const { backend } = await import('/src/lib/supabase/client.ts');
      const { error } = await backend().auth.refreshSession();
      if (error) throw Error('Tokenaktualisierung fehlgeschlagen');
    });
    await ready(b);
    assert.equal(
      await b.getByLabel('Name', { exact: true }).inputValue(),
      'Eigener Entwurf',
    );
    await link(a, wish + ' bearbeiten').click();
    await a.getByLabel('Name', { exact: true }).fill('Aprikosen neu');
    await measured(
      'Einkauf bearbeiten',
      a,
      'edit_shopping',
      () => button(a, 'Speichern').click(),
      [() => box(c, 'Aprikosen neu', false).waitFor()],
    );
    await button(b, 'Aktuellen Stand als Grundlage verwenden').waitFor();
    assert.equal(
      await b.getByLabel('Name', { exact: true }).inputValue(),
      'Eigener Entwurf',
    );
    assert.ok(await button(b, 'Speichern').isDisabled());
    await link(b, 'Abbrechen').click();
    await box(b, 'Aprikosen neu', false).waitFor();
    await b.context().setOffline(true);
    await b.getByText(/Offline ·/).waitFor();
    await button(a, 'Aprikosen neu entfernen').click();
    await button(a, 'Abbrechen').click();
    await button(a, 'Aprikosen neu entfernen').click();
    await measured(
      'Einkauf entfernen',
      a,
      'delete_shopping',
      () => button(a, 'Eintrag entfernen').click(),
      [() => box(c, 'Aprikosen neu', false).waitFor({ state: 'hidden' })],
    );
    assert.ok(await box(b, 'Aprikosen neu', false).isVisible());
    const reconnect = performance.now();
    await b.context().setOffline(false);
    await box(b, 'Aprikosen neu', false).waitFor({ state: 'hidden' });
    const ms = Math.ceil(performance.now() - reconnect);
    assert.ok(ms <= 3000);
    samples.push({ aktion: 'Netzrückkehr', ms });
    await ready(b);
  });
  await step(
    '009B · Unklare Einkaufsanlage und identischer Wiederholungsauftrag',
    async () => {
      await link(a, 'Eintrag hinzufügen').click();
      await a.getByLabel('Name', { exact: true }).fill('Lauch');
      let original;
      await a.route(
        '**/rpc/create_shopping',
        async (route) => {
          original = route.request().postData();
          const result = await route.fetch();
          assert.equal((await result.json()).ok, true);
          await route.abort('failed');
        },
        { times: 1 },
      );
      await button(a, 'Speichern').click();
      await button(a, 'Ursprüngliche Anfrage identisch wiederholen').waitFor();
      await a.getByLabel('Name', { exact: true }).fill('Anderer Entwurf');
      assert.ok(await button(a, 'Speichern').isDisabled());
      const replay = a.waitForRequest((r) =>
        r.url().endsWith('/rpc/create_shopping'),
      );
      await button(a, 'Ursprüngliche Anfrage identisch wiederholen').click();
      assert.equal((await replay).postData(), original);
      await box(a, 'Lauch', false).waitFor();
      assert.equal(await box(a, 'Lauch', false).count(), 1);
      assert.equal(await box(a, 'Anderer Entwurf', false).count(), 0);
    },
  );
  await step(
    '009B · Versionskonflikt vor Signaleingang und Korrekturlöschung',
    async () => {
      const fields = {
        name: 'Prüfcharge Konflikt',
        quantity: '4',
        unit: 'Stück',
        category: 'Sonstiges',
        location: null,
        barcode: null,
        expiry_date: null,
        date_type: null,
      };
      const created = await write(b, 'create_item', { fields, ack: false });
      let base = created.version;
      const path = '/inventory/' + created.id;
      for (const edit of [true, false]) {
        await go(a, path + (edit ? '/edit' : '/consume'));
        if (edit)
          await a
            .getByLabel('Produktname', { exact: true })
            .fill('Eigener Entwurf');
        else await button(a, 'Gesamten Bestand entfernen').click();
        const gate = Promise.withResolvers();
        const target = '**/rest/v1/active_inventory?*';
        const hold = async (route) => {
          await gate.promise;
          await route.continue().catch(() => {});
        };
        await a.route(target, hold);
        try {
          fields.quantity = edit ? '3' : '2';
          base = (
            await write(b, 'edit_item', {
              id: created.id,
              v: base,
              fields,
              ack: false,
            })
          ).version;
          const rpc = edit ? 'edit_item' : 'consume_item';
          const reply = a.waitForResponse(
            (r) =>
              r.url().endsWith('/rpc/' + rpc) &&
              r.request().method() === 'POST',
          );
          await button(
            a,
            edit ? 'Änderungen speichern' : 'Vollständig entfernen',
          ).click();
          assert.equal((await (await reply).json()).code, 'STALE');
        } finally {
          gate.resolve();
          await a.unroute(target, hold);
        }
        assert.equal(
          sql(
            "select quantity from public.inventory_items where id='" +
              created.id +
              "'",
          ),
          fields.quantity,
        );
      }
      await go(a, path);
      await a
        .getByRole('heading', { name: fields.name, exact: true })
        .waitFor();
      await measured(
        'Vorratscharge löschen',
        b,
        'delete_item',
        () =>
          write(b, 'delete_item', { id: created.id, v: base, confirm: true }),
        [
          () =>
            a
              .getByRole('heading', {
                name: 'Eintrag nicht verfügbar',
                exact: true,
              })
              .waitFor(),
        ],
      );
    },
  );
  await step(
    '009B · Folgeänderungen, Vollverbrauch und fremder Haushalt',
    async () => {
      await go(b, '/inventory');
      await row(b, renamed).waitFor();
      for (const desired of ['1', '2'])
        version = (
          await write(a, 'set_reservation', { id, v: version, desired })
        ).version;
      await measured(
        'Reservierung ändern nach Folgeaufträgen',
        a,
        'set_reservation',
        async () => {
          version = (
            await write(a, 'set_reservation', { id, v: version, desired: '3' })
          ).version;
        },
        [
          () =>
            row(b, renamed)
              .getByText(/3 Stück reserviert · 4 Stück frei/)
              .waitFor(),
        ],
      );
      await measured(
        'Vollverbrauch',
        a,
        'consume_item',
        () =>
          write(a, 'consume_item', {
            id,
            unit: 'Stück',
            amount: '7',
            confirm_full: true,
            confirmed_v: version,
          }),
        [() => row(b, renamed).waitFor({ state: 'hidden' })],
      );
      assert.equal(await d.locator('.shopping-list li').count(), 0);
      await Promise.all([a, b, c, d].map((p) => go(p, '/household')));
      await Promise.all(
        [a, b, c].map((p) =>
          p.getByRole('heading', { name: 'WG A', exact: true }).waitFor(),
        ),
      );
      await d.getByRole('heading', { name: 'WG D', exact: true }).waitFor();
      await writeFile(
        dir + '/' + report + '.json',
        JSON.stringify(samples, null, 2) + '\n',
      );
      console.log(
        '009B Messwerte in ms · ' + samples.map((s) => s.ms).join(', '),
      );
    },
  );
  await step('009B · Einkauf über mehrere Seiten je Zustand', async () => {
    await go(a, '/shopping');
    await box(a, 'Lauch', false).waitFor();
    const h = await a.evaluate(
      async () =>
        (await import('/src/features/auth/session.ts')).activeScope().household,
    );
    assert.match(h, /^[a-f0-9-]{36}$/);
    sql(
      "insert into public.shopping_items(household_id,name,checked) select '" +
        h +
        "','Einkaufsprobe '||n,n>102 from generate_series(1,205) n",
    );
    for (const [title, total] of [
      ['Offen', 103],
      ['Eingekauft', 103],
    ]) {
      const boxes = a
        .getByRole('region', { name: title, exact: true })
        .getByRole('checkbox');
      await boxes.nth(total - 1).waitFor({ state: 'attached' });
      assert.equal(await boxes.count(), total);
    }
    sql(
      "delete from public.shopping_items where household_id='" +
        h +
        "' and name like 'Einkaufsprobe %'",
    );
    await a
      .getByRole('checkbox', { name: 'Einkaufsprobe 1', exact: true })
      .waitFor({ state: 'detached' });
  });

  // Ausschliesslich die eigenen synthetischen Daten für den folgenden Leerzustands-Test räumen.
  const h = await a.evaluate(
    async () =>
      (await import('/src/features/auth/session.ts')).activeScope().household,
  );
  assert.match(h, /^[a-f0-9-]{36}$/);
  assert.match(id, /^[a-f0-9-]{36}$/);
  sql(
    "delete from public.inventory_items where id='" +
      id +
      "' and household_id='" +
      h +
      "' and status='consumed'",
  );
  await button(a, 'Lauch entfernen').click();
  await button(a, 'Eintrag entfernen').click();
  await box(a, 'Lauch', false).waitFor({ state: 'detached' });
  await go(a, '/household');
  await a.getByRole('heading', { name: 'WG A', exact: true }).waitFor();
}
