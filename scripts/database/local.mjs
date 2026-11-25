import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  readFileSync,
  existsSync,
  mkdirSync,
  symlinkSync,
  writeFileSync,
  realpathSync,
} from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';

// Die Auswahl gilt für diesen Prozess, unabhängig vom Namen der Arbeitskopie.
const selection = process.env.ZAEME_TEST_STACK;
const parallel = selection?.match(/^task([0-9]{3})$/);
assert.ok(
  !selection || selection === 'integration' || parallel,
  'Unbekannter Teststack',
);
const task = parallel?.[1] ?? '005';
const integration = selection === 'integration';
const offset = integration ? 1500 : (Number(task) - 5) * 500;
assert.ok(offset >= 0 && 54329 + offset <= 65535);
export const project = integration
  ? 'zaeme-integration-0071'
  : 'zaeme-task' + task + '-local';
const workdir = integration
  ? resolve('.local-stack/integration')
  : offset
    ? resolve('.local-stack', project)
    : process.cwd();
const apiPort = 54321 + offset;
const dbPort = 54322 + offset;
export const network = project + '-loopback';
export const container = 'supabase_db_' + project;
export const api = 'http://127.0.0.1:' + apiPort;
export const mail = 'http://127.0.0.1:' + (54324 + offset);
function prepareWorkdir() {
  if (!offset) return;
  const dir = resolve(workdir, 'supabase');
  mkdirSync(dir, { recursive: true });
  const config = readFileSync('supabase/config.toml', 'utf8')
    .replace(
      'project_id = "zaeme-task005-local"',
      'project_id = "' + project + '"',
    )
    .replace(
      /^(# )?((?:\w+_)?port = )(5432\d|8083)$/gm,
      (_, comment, key, port) =>
        (comment ?? '') + key + (Number(port) + offset),
    );
  const configPath = resolve(dir, 'config.toml');
  if (!existsSync(configPath) || readFileSync(configPath, 'utf8') !== config)
    writeFileSync(configPath, config);
  for (const name of ['migrations', 'tests']) {
    const source = resolve('supabase', name);
    const link = resolve(dir, name);
    if (!existsSync(link)) symlinkSync(source, link, 'junction');
    assert.equal(realpathSync(link), realpathSync(source));
  }
}
export function cli(...args) {
  const networkArgs = ['start', 'db', 'test'].includes(args[0])
    ? ['--network-id', network]
    : [];
  return execFileSync(
    process.execPath,
    [
      'node_modules/supabase/dist/supabase.js',
      ...args,
      ...networkArgs,
      '--workdir',
      workdir,
    ],
    {
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'inherit'],
    },
  );
}
export function docker(...args) {
  return execFileSync('docker', args, { encoding: 'utf8' }).trim();
}
export function localEngine() {
  prepareWorkdir();
  assert.match(
    readFileSync('supabase/config.toml', 'utf8'),
    /^project_id = "zaeme-task005-local"$/m,
  );
  assert.equal(
    existsSync('supabase/.temp/project-ref'),
    false,
    'Verknüpftes Projekt',
  );
  assert.equal(
    existsSync('supabase/.temp/linked-project.json'),
    false,
    'Verknüpftes Projekt',
  );
  for (const marker of ['project-ref', 'linked-project.json'])
    assert.ok(
      !existsSync(resolve(workdir, 'supabase', '.temp', marker)),
      'Verknüpftes Projekt',
    );
  const config = readFileSync(resolve(workdir, 'supabase/config.toml'), 'utf8');
  assert.ok(config.split(/\r?\n/).includes('project_id = "' + project + '"'));
  for (const [section, port] of [
    ['api', apiPort],
    ['db', dbPort],
  ]) {
    assert.equal(
      Number(
        config
          .split('[' + section + ']')[1]
          .split(/^\[/m)[0]
          .match(/^port = (\d+)$/m)?.[1],
      ),
      port,
    );
  }
  const contextEndpoint = docker(
    'context',
    'inspect',
    '--format',
    '{{.Endpoints.docker.Host}}',
  );
  assert.match(
    contextEndpoint,
    /^(unix:\/\/\/|npipe:\/\/\/\/\.\/pipe\/)/,
    'Lokaler Docker-Kontext erforderlich',
  );
  const endpoint = process.env.DOCKER_HOST || contextEndpoint;
  assert.match(
    endpoint,
    /^(unix:\/\/\/|npipe:\/\/\/\/\.\/pipe\/)/,
    'Lokaler Docker-Socket erforderlich',
  );
}
export function checkBindings() {
  const names = docker(
    'ps',
    '--filter',
    'label=com.supabase.cli.project=' + project,
    '--format',
    '{{.Names}}',
  ).split(/\r?\n/);
  assert.ok(names.includes(container));
  const loopback = ['127.0.0.1', '::1'];
  const published = new Set();
  try {
    for (const name of names) {
      const ports = JSON.parse(
        docker('inspect', '--format', '{{json .NetworkSettings.Ports}}', name),
      );
      if (name === container)
        assert.ok(
          ports['5432/tcp']?.some((b) => Number(b.HostPort) === dbPort),
        );
      if (name === 'supabase_kong_' + project)
        assert.ok(
          ports['8000/tcp']?.some((b) => Number(b.HostPort) === apiPort),
        );
      for (const bindings of Object.values(ports ?? {})) {
        for (const b of bindings ?? []) {
          assert.match(b.HostPort, /^[0-9]{1,5}$/);
          published.add(Number(b.HostPort));
          // Desktop meldet gelegentlich :: innerhalb der VM ohne IPv6-Listener auf Windows.
          const desktopIPv6 =
            process.platform === 'win32' &&
            b.HostIp === '::' &&
            bindings.some(
              (v) => v.HostIp === '127.0.0.1' && v.HostPort === b.HostPort,
            );
          assert.ok(loopback.includes(b.HostIp) || desktopIPv6);
        }
      }
    }
    assert.ok(published.has(apiPort) && published.has(dbPort));
    if (process.platform === 'win32') {
      const query =
        'Get-NetTCPConnection -ErrorAction Stop -State Listen -LocalPort ' +
        [...published].join(',') +
        ' | Select-Object LocalPort,LocalAddress | ConvertTo-Json -Compress';
      const result = execFileSync(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-Command', query],
        { encoding: 'utf8' },
      );
      const listeners = [].concat(JSON.parse(result));
      for (const port of published) {
        const actual = listeners.filter((l) => l.LocalPort === port);
        assert.ok(
          actual.length > 0 &&
            actual.every((l) => loopback.includes(l.LocalAddress)),
        );
      }
    }
  } catch {
    cli('stop');
    throw new Error(
      'Teststack gestoppt. Loopback-Bindung nicht nachgewiesen. Standard-Portbindung in Docker Desktop auf localhost setzen oder den isolierten Linux-Runner verwenden.',
    );
  }
}
export function localStatus() {
  localEngine();
  const label = docker(
    'inspect',
    '--format',
    '{{index .Config.Labels "com.supabase.cli.project"}}',
    container,
  );
  assert.equal(label, project);
  const status = JSON.parse(cli('status', '-o', 'json'));
  assert.equal(status.API_URL, api);
  const db = new URL(status.DB_URL);
  assert.equal(db.hostname, '127.0.0.1');
  assert.equal(db.port, String(dbPort));
  assert.equal(db.pathname, '/postgres');
  return status;
}
// Ausschliesslich Setup und unabhängige Prüfung im zuvor identifizierten Testcontainer.
export function sql(query) {
  return execFileSync(
    'docker',
    [
      'exec',
      '-i',
      container,
      'psql',
      '-X',
      '-qAt',
      '-U',
      'postgres',
      '-d',
      'postgres',
      '-v',
      'ON_ERROR_STOP=1',
    ],
    { input: query, encoding: 'utf8' },
  ).trim();
}
