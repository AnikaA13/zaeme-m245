import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import process from 'node:process';
import { format, resolveConfig } from 'prettier';
import {
  cli,
  docker,
  localEngine,
  localStatus,
  project,
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
  if (
    docker(
      'ps',
      '--filter',
      'label=com.supabase.cli.project=' + project,
      '--format',
      '{{.Names}}',
    )
  ) {
    localStatus();
    checkBindings();
    cli('stop');
  }
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
      cli(
        'db',
        'reset',
        '--local',
        '--no-seed',
        '--yes',
        '--version',
        '20261125000200',
      );
      localStatus();
      checkBindings();
      assert.equal(
        sql(
          "select to_regclass('public.inventory_items') is null and array(select version from supabase_migrations.schema_migrations order by version) = array['20261125000100','20261125000200']",
        ),
        't',
      );
      sql(`begin;
        insert into auth.users(id,email_confirmed_at) values ('00000000-0007-4000-8000-000000000001',now());
        insert into public.profiles(id,display_name) values ('00000000-0007-4000-8000-000000000001','Upgradeprüfung');
        insert into public.households(id,owner_id,name) values ('00000000-0007-4000-8000-000000000002','00000000-0007-4000-8000-000000000001','Prüfhaushalt');
        insert into public.household_members(household_id,user_id) values ('00000000-0007-4000-8000-000000000002','00000000-0007-4000-8000-000000000001');
        insert into public.household_invites(household_id,created_by,token_hash)
          select id,owner_id,sha256('Upgradeprüfung'::bytea) from public.households where id='00000000-0007-4000-8000-000000000002';
        commit;`);
      const snapshot = () =>
        sql(`select jsonb_build_array(
        (select jsonb_agg(p) from public.profiles p),
        (select jsonb_agg(h) from public.households h),
        (select jsonb_agg(m) from public.household_members m),
        (select jsonb_agg(i) from public.household_invites i))`);
      const before = snapshot();
      cli('migration', 'up', '--local');
      assert.equal(snapshot(), before, 'Bestehende Haushaltsdaten unverändert');
      localStatus();
      checkBindings();
      sql(`begin;
        delete from public.households where owner_id='00000000-0007-4000-8000-000000000001';
        delete from auth.users where id='00000000-0007-4000-8000-000000000001';
        commit;`);
      assert.equal(sql('select count(*) from public.profiles'), '0');
      assert.equal(
        sql(
          "select count(*) from supabase_migrations.schema_migrations where version in ('20261125000300','20261125000400')",
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
