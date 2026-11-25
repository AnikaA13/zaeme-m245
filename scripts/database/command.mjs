import assert from 'node:assert/strict';
import {
  readFileSync,
  writeFileSync,
  mkdtempDisposableSync,
  mkdirSync,
  copyFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import { format, resolveConfig } from 'prettier';
import {
  cli,
  docker,
  localEngine,
  localStatus,
  network,
  checkBindings,
  sql,
} from './local.mjs';

const command = process.argv[2];
const typeFile = 'src/database.types.ts';
if (command === 'start') {
  localEngine();
  if (
    !docker('network', 'ls', '--format', '{{.Name}}')
      .split(/\r?\n/)
      .includes(network)
  ) {
    docker(
      'network',
      'create',
      '--opt',
      'com.docker.network.bridge.host_binding_ipv4=127.0.0.1',
      network,
    );
  }
  assert.equal(
    docker(
      'network',
      'inspect',
      network,
      '--format',
      '{{index .Options "com.docker.network.bridge.host_binding_ipv4"}}',
    ),
    '127.0.0.1',
  );
  cli(
    'start',
    '-x',
    'studio,realtime,storage-api,imgproxy,edge-runtime,logflare,vector,supavisor',
  );
  localStatus();
  checkBindings();
  console.log('Lokale Datenbank und API bereit.');
} else if (command === 'stop') {
  localEngine();
  cli('stop');
} else {
  localStatus();
  checkBindings();
  switch (command) {
    case 'reset':
      cli('db', 'reset', '--local', '--no-seed', '--yes');
      checkBindings();
      break;
    case 'migrate':
      cli('migration', 'up', '--local');
      break;
    case 'upgrade-check': {
      // M0 hatte keine Migration. Dieselbe geprüfte Projekt-ID ohne SQL-Dateien initialisieren.
      const baseline = mkdtempDisposableSync(
        join(tmpdir(), 'zaeme-task005-baseline-'),
      );
      try {
        const configDir = join(baseline.path, 'supabase');
        mkdirSync(configDir);
        copyFileSync('supabase/config.toml', join(configDir, 'config.toml'));
        cli(
          'db',
          'reset',
          '--local',
          '--no-seed',
          '--yes',
          '--workdir',
          baseline.path,
        );
      } finally {
        baseline.remove();
      }
      checkBindings();
      assert.equal(
        sql(
          "select to_regclass('auth.users') is not null and to_regclass('public.profiles') is null",
        ),
        't',
      );
      cli('migration', 'up', '--local');
      assert.equal(
        sql(
          "select count(*) from supabase_migrations.schema_migrations where version in ('20261125000100','20261125000200')",
        ),
        '2',
      );
      break;
    }
    case 'sql':
      console.log(cli('test', 'db', '--local'));
      break;
    case 'types':
    case 'types-check': {
      const raw = cli(
        'gen',
        'types',
        'typescript',
        '--local',
        '--schema',
        'public',
      );
      const types = await format(raw, {
        ...(await resolveConfig(typeFile)),
        filepath: typeFile,
        endOfLine: 'lf',
      });
      assert.ok(
        types.includes('save_profile') && types.includes('household_members'),
      );
      if (command === 'types') writeFileSync(typeFile, types);
      else
        assert.equal(
          readFileSync(typeFile, 'utf8').replaceAll('\r\n', '\n'),
          types,
        );
      break;
    }
    default:
      throw new Error('Unbekannter Datenbankbefehl.');
  }
}
