import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { type Ean13 } from './ean';
const code = '0034000470693' as Ean13;
const ok = {
  code,
  status: 'success',
  result: { id: 'product_found' },
  product: { product_name: ' Cocoa ', product_name_de: ' Kakao ' },
};
let lookup: typeof import('./lookup').lookupProduct;
let owner: AbortController;
const fetcher = vi.fn<typeof fetch>();
function reply(data: unknown, status = 200) {
  fetcher.mockResolvedValue(Response.json(data, { status }));
}
beforeEach(async () => {
  vi.resetModules();
  lookup = (await import('./lookup')).lookupProduct;
  owner = new AbortController();
  fetcher.mockReset();
  vi.stubGlobal('fetch', fetcher);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it('sendet nur den Code und die Feldauswahl, übernimmt nur den Namen', async () => {
  reply(ok);
  expect(await lookup(code, owner.signal)).toEqual({
    kind: 'found',
    prefill: { barcode: code, name: 'Kakao' },
  });
  expect(fetcher).toHaveBeenCalledExactlyOnceWith(
    'https://world.openfoodfacts.org/api/v3/product/0034000470693.json?fields=product_name_de,product_name',
    {
      credentials: 'omit',
      redirect: 'error',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      signal: expect.any(AbortSignal),
    },
  );
});
it('verwendet den verfügbaren allgemeinen Namen', async () => {
  reply({ ...ok, product: { product_name: ' Cocoa ' } });
  expect(await lookup(code, owner.signal)).toMatchObject({
    kind: 'found',
    prefill: { name: 'Cocoa' },
  });
});
it('erkennt unbekannten Code anhand der geprüften Antwort', async () => {
  reply({ code, status: 'failure', result: { id: 'product_not_found' } }, 404);
  expect(await lookup(code, owner.signal)).toEqual({
    kind: 'unknown',
    prefill: { barcode: code },
  });
});
it.each([{}, { product_name: ' ' }, { product_name_de: 'x'.repeat(101) }])(
  'behält Barcode bei fehlendem brauchbarem Namen',
  async (product) => {
    reply({ ...ok, product });
    expect(await lookup(code, owner.signal)).toEqual({
      kind: 'incomplete',
      prefill: { barcode: code },
    });
  },
);
it.each([
  null,
  {},
  { ...ok, product: [] },
  { ...ok, product: { product_name: 17 } },
  { ...ok, code: '3017620422003' },
  { ...ok, status: 'failure' },
  { ...ok, result: {} },
])('prüft Antwortstruktur', async (body) => {
  reply(body);
  expect(await lookup(code, owner.signal)).toEqual({
    kind: 'failed',
    reason: 'invalid-response',
    prefill: { barcode: code },
  });
});
it('wertet ungültiges JSON bei 404 nicht als unbekannt', async () => {
  fetcher.mockResolvedValue(new Response('<html>', { status: 404 }));
  expect(await lookup(code, owner.signal)).toMatchObject({
    reason: 'invalid-response',
  });
});
it('meldet Netzfehler', async () => {
  fetcher.mockRejectedValue(new TypeError('offline'));
  expect(await lookup(code, owner.signal)).toMatchObject({
    kind: 'failed',
    reason: 'network',
    prefill: { barcode: code },
  });
});
it('beachtet 429 und Retry-After', async () => {
  vi.useFakeTimers();
  fetcher.mockResolvedValue(
    new Response(null, { status: 429, headers: { 'Retry-After': '120' } }),
  );
  expect(await lookup(code, owner.signal)).toMatchObject({
    reason: 'rate-limit',
  });
  vi.advanceTimersByTime(61000);
  expect(await lookup(code, owner.signal)).toMatchObject({
    reason: 'rate-limit',
  });
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it('begrenzt auch erfolgreiche Abfragen pro Minute', async () => {
  reply(ok);
  for (let n = 0; n < 15; n++) await lookup(code, owner.signal);
  expect(await lookup(code, owner.signal)).toMatchObject({
    reason: 'rate-limit',
  });
  expect(fetcher).toHaveBeenCalledTimes(15);
});
it.each(['timeout', 'cancelled'])(
  'bricht den laufenden HTTP-Request ab (%s)',
  async (why) => {
    vi.useFakeTimers();
    fetcher.mockImplementation(
      (_url, opts) =>
        new Promise((_resolve, reject) =>
          opts?.signal?.addEventListener('abort', () =>
            reject(new DOMException('', 'AbortError')),
          ),
        ),
    );
    const pending = lookup(code, owner.signal);
    if (why === 'timeout') await vi.advanceTimersByTimeAsync(5000);
    else owner.abort();
    expect(await pending).toEqual(
      why === 'timeout'
        ? { kind: 'failed', reason: why, prefill: { barcode: code } }
        : { kind: why, prefill: { barcode: code } },
    );
  },
);
it('startet keine Anfrage nach Abbruch oder mit ungültiger EAN', async () => {
  owner.abort();
  expect(await lookup(code, owner.signal)).toMatchObject({ kind: 'cancelled' });
  expect(await lookup('123' as Ean13, new AbortController().signal)).toEqual({
    kind: 'invalid',
  });
  expect(fetcher).not.toHaveBeenCalled();
});
