import { isEan13, type Ean13 } from './ean';

export type LookupFailure =
  'network' | 'timeout' | 'rate-limit' | 'invalid-response';
export type CapturePrefill = { barcode: Ean13; name?: string };
export type LookupResult =
  | { kind: 'found'; prefill: CapturePrefill & { name: string } }
  | {
      kind: 'unknown' | 'incomplete' | 'cancelled';
      prefill: { barcode: Ean13 };
    }
  | { kind: 'failed'; reason: LookupFailure; prefill: { barcode: Ean13 } }
  | { kind: 'invalid' };

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function classify(barcode: Ean13, status: number, data: unknown): LookupResult {
  const prefill = { barcode };
  const invalid = {
    kind: 'failed',
    reason: 'invalid-response',
    prefill,
  } as const;
  if (!record(data) || typeof data.code !== 'string' || !record(data.result))
    return invalid;
  // OFF kann äquivalente, mit Nullen aufgefüllte GTIN in Normalform liefern.
  if (
    !/^(?:[0-9]{8}|[0-9]{13})$/.test(data.code) ||
    data.code.padStart(13, '0') !== barcode
  )
    return invalid;
  if (
    (status === 404 || status === 200) &&
    data.status === 'failure' &&
    data.result.id === 'product_not_found'
  )
    return { kind: 'unknown', prefill };
  if (
    status !== 200 ||
    (data.status !== 'success' && data.status !== 'success_with_warnings') ||
    data.result.id !== 'product_found' ||
    !record(data.product)
  )
    return invalid;
  for (const key of ['product_name_de', 'product_name']) {
    const value = data.product[key];
    if (value == null) continue;
    if (typeof value !== 'string') return invalid;
    const name = value.trim();
    if (name && [...name].length <= 100)
      return { kind: 'found', prefill: { barcode, name } };
  }
  return { kind: 'incomplete', prefill };
}

let requests: number[] = [];
let blockedUntil = 0;

export async function lookupProduct(
  barcode: Ean13,
  signal: AbortSignal,
): Promise<LookupResult> {
  if (!isEan13(barcode)) return { kind: 'invalid' };
  const prefill = { barcode };
  const failed = (reason: LookupFailure): LookupResult => ({
    kind: 'failed',
    reason,
    prefill,
  });
  if (signal.aborted) return { kind: 'cancelled', prefill };
  const now = Date.now();
  requests = requests.filter((at) => at > now - 60000);
  if (requests.length >= 15 || now < blockedUntil) return failed('rate-limit');
  requests.push(now);

  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal.addEventListener('abort', cancel, { once: true });
  const timer = setTimeout(cancel, 5000);
  try {
    const response = await fetch(
      'https://world.openfoodfacts.org/api/v3/product/' +
        barcode +
        '.json?fields=product_name_de,product_name',
      {
        signal: controller.signal,
        credentials: 'omit',
        cache: 'no-store',
        redirect: 'error',
        referrerPolicy: 'no-referrer',
      },
    );
    if (response.status === 429) {
      const retry = response.headers.get('Retry-After')?.trim();
      const next =
        retry && /^\d+$/.test(retry)
          ? Date.now() + Number(retry) * 1000
          : Date.parse(retry ?? '');
      blockedUntil = Math.max(
        blockedUntil,
        Date.now() + 60000,
        Number.isFinite(next) ? next : 0,
      );
      return failed('rate-limit');
    }
    if (!response.ok && response.status !== 404) return failed('network');
    const data: unknown = await response.json();
    return classify(barcode, response.status, data);
  } catch (error) {
    if (signal.aborted) return { kind: 'cancelled', prefill };
    if (controller.signal.aborted) return failed('timeout');
    return failed(
      error instanceof SyntaxError ? 'invalid-response' : 'network',
    );
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', cancel);
  }
}
