import type { IncomingMessage, ServerResponse } from 'node:http';
import { afterEach, expect, it, vi } from 'vitest';
import product from '../../api/product';

afterEach(() => vi.unstubAllGlobals());

function request(method: string, url: string) {
  const req = {
    method,
    url,
    headers: { cookie: 'intern', authorization: 'intern' },
  } as IncomingMessage;
  const reply = {
    setHeader: vi.fn(),
    writeHead: vi.fn().mockReturnThis(),
    end: vi.fn(),
  };
  return { req, res: reply as unknown as ServerResponse, reply };
}
it('fragt nur den Namen mit eigener Anbieterkennung ab und begrenzt die Antwort', async () => {
  const code = '0034000470693';
  const data = {
    code,
    result: { id: 'product_found' },
    status: 'success',
    product: { product_name: 'Kakao' },
  };
  const upstream = vi.fn().mockResolvedValue(
    Response.json({
      ...data,
      private: 'entfernen',
      product: { ...data.product, image: 'entfernen' },
    }),
  );
  vi.stubGlobal('fetch', upstream);
  const { req, res, reply } = request('GET', '/api/product?ean=' + code);
  await product(req, res);
  expect(upstream).toHaveBeenCalledExactlyOnceWith(
    'https://world.openfoodfacts.org/api/v3/product/' +
      code +
      '.json?fields=product_name_de,product_name',
    {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'zaeme/0.1.0 (https://github.com/AnikaA13/zaeme-m245)',
      },
      redirect: 'error',
      signal: expect.anything(),
    },
  );
  expect(reply.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
  expect(reply.writeHead).toHaveBeenCalledWith(200, {
    'Content-Type': 'application/json',
  });
  expect(JSON.parse(reply.end.mock.calls[0][0])).toEqual(data);
});
it.each([
  ['POST', '?ean=0034000470693', 405],
  ['GET', '?ean=123', 400],
  ['GET', '?ean=0034000470693&name=intern', 400],
])('begrenzt Methode und Parameter: %s %s', async (method, query, status) => {
  const upstream = vi.fn();
  vi.stubGlobal('fetch', upstream);
  const { req, res, reply } = request(String(method), '/api/product' + query);
  await product(req, res);
  expect(reply.writeHead).toHaveBeenCalledWith(status);
  expect(upstream).not.toHaveBeenCalled();
});
