import { test } from 'node:test';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { apiFixture } from './api-fixture.mjs';
import { operationId } from './fixtures.mjs';
import { api, browserPort, localStatus } from './local.mjs';
import { shoppingSync } from './browser-shopping.mjs';
import { layout } from './browser-layout.mjs';

test('009B · Vier unabhängige Browsersitzungen auf dem lokalen Stack', async (t) => {
  const fixture = apiFixture(t);
  const users = await Promise.all(
    ['Anna', 'Bea', 'Cora', 'Dani'].map(fixture.profiled),
  );
  const rpc = async (user, name, args) =>
    fixture.success(
      await fixture.rpc(user, name, { op: operationId(), ...args }),
    );
  await rpc(users[0], 'create_household', { name: 'WG A' });
  await rpc(users[3], 'create_household', { name: 'WG D' });
  const invite = await fixture.makeInvite(
    users[0],
    await fixture.context(users[0]),
  );
  for (const user of users.slice(1, 3))
    await rpc(user, 'join_household', { token: invite.token });
  process.env.VITE_SUPABASE_URL = api;
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY =
    localStatus().PUBLISHABLE_KEY || fixture.guest;
  const origin = 'http://127.0.0.1:' + browserPort;
  const server = await createServer({
    logLevel: 'error',
    server: {
      host: '127.0.0.1',
      port: browserPort,
      strictPort: true,
      hmr: false,
    },
  });
  await server.listen();
  t.after(() => server.close());
  const browser = await chromium.launch();
  t.after(() => browser.close());
  const mobile = await chromium.launch();
  t.after(() => mobile.close());
  const pages = await Promise.all(
    users.map(async (user, index) => {
      const page = await (index === 1 ? mobile : browser).newPage({
        viewport: { width: 390, height: 844 },
        locale: 'de-CH',
      });
      await page
        .context()
        .route('**/*', (route) =>
          [origin, api].includes(new URL(route.request().url()).origin)
            ? route.continue()
            : route.abort(),
        );
      await page.goto(origin);
      await page.evaluate(
        async (tokens) => {
          const { backend } = await import('/src/lib/supabase/client.ts');
          const { error } = await backend().auth.setSession(tokens);
          if (error) throw Error('Testanmeldung fehlgeschlagen');
        },
        { access_token: user.jwt, refresh_token: user.refresh },
      );
      await page.getByRole('link', { name: 'Haushalt', exact: true }).waitFor();
      return page;
    }),
  );
  const [a, b, c, d] = pages;
  await shoppingSync({
    a,
    b,
    c,
    d,
    origin,
    layout,
    report: 'messungen-einzellauf',
    step: async (name, fn) => {
      try {
        await fn();
        console.log('PASS ' + name);
      } catch (error) {
        for (const [index, p] of pages.entries()) {
          console.log(
            'Kontext ' + index,
            new URL(p.url()).pathname,
            await p.locator('h1').allTextContents(),
            await p.locator('.stock-list strong').allTextContents(),
            await p
              .locator('small[role=status],p[role=alert]')
              .allTextContents(),
          );
        }
        throw error;
      }
    },
  });
});
