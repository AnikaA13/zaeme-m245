import type { IncomingMessage, ServerResponse } from 'node:http';
import { isEan13 } from '../src/features/barcode/ean.ts';

// Öffentlicher, lesender Produktzugriff. Ziel, Felder und Anbieterkennung sind fest.
export default async function product(
  req: IncomingMessage,
  res: ServerResponse,
) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.writeHead(405).end();
    return;
  }
  const query = new URL(req.url ?? '/', 'http://localhost').searchParams;
  const code = query.get('ean');
  if (query.size !== 1 || !isEan13(code)) {
    res.writeHead(400).end();
    return;
  }
  try {
    const upstream = await fetch(
      'https://world.openfoodfacts.org/api/v3/product/' +
        code +
        '.json?fields=product_name_de,product_name',
      {
        headers: {
          'User-Agent': 'zaeme/0.1.0 (https://github.com/AnikaA13/zaeme-m245)',
          Accept: 'application/json',
        },
        redirect: 'error',
        signal: AbortSignal.timeout(4500),
      },
    );
    if (upstream.status === 429) {
      const retry = upstream.headers.get('Retry-After');
      if (retry) res.setHeader('Retry-After', retry);
      res.writeHead(429).end();
      return;
    }
    if (![200, 404].includes(upstream.status)) {
      res.writeHead(502).end();
      return;
    }
    const data = await upstream.json();
    const safe = {
      code: data.code,
      result: { id: data.result?.id },
      status: data.status,
      product: data.product && {
        product_name: data.product.product_name,
        product_name_de: data.product.product_name_de,
      },
    };
    res
      .writeHead(upstream.status, { 'Content-Type': 'application/json' })
      .end(JSON.stringify(safe));
  } catch {
    res.writeHead(502).end();
  }
}
