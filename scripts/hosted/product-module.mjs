import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execPath } from 'node:process';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';

test('Die kompilierte Produktfunktion lädt in Node und prüft EAN-Eingaben', async (t) => {
  const output = await mkdtemp(join(tmpdir(), 'zaeme-produktmodul-'));
  t.after(() => rm(output, { recursive: true, force: true }));
  await writeFile(join(output, 'package.json'), '{"type":"module"}');
  execFileSync(execPath, [
    resolve('node_modules/typescript/bin/tsc'),
    '--module',
    'NodeNext',
    '--target',
    'ES2022',
    '--strict',
    '--skipLibCheck',
    '--rootDir',
    '.',
    '--outDir',
    output,
    'api/product.ts',
  ]);
  const { default: handler } = await import(
    pathToFileURL(join(output, 'api/product.js')).href
  );
  const server = createServer(handler);
  await new Promise((ready) => server.listen(0, '127.0.0.1', ready));
  t.after(() => new Promise((done) => server.close(done)));
  const response = await globalThis.fetch(
    'http://127.0.0.1:' + server.address().port + '/api/product?ean=123',
  );
  assert.equal(response.status, 400);
  assert.equal(response.headers.get('cache-control'), 'no-store');
});
