begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select no_plan();
select is(current_setting('server_version_num')::int / 10000,17,'PostgreSQL 17');
select ok((select bool_and(relrowsecurity) and count(*)=6 from pg_class where oid = any(array[
  'profiles'::regclass,'households'::regclass,'household_members'::regclass,'household_invites'::regclass,
  'private.operation_results'::regclass,'private.invite_attempts'::regclass])), 'RLS auf allen sechs Tabellen');
select ok(not has_table_privilege(r,t,p), r || ' ohne ' || p || ' auf ' || t)
from unnest(array['anon','authenticated']) r cross join
unnest(array['profiles','households','household_members','household_invites','private.operation_results','private.invite_attempts']) t
cross join unnest(array['INSERT','UPDATE','DELETE','TRUNCATE','TRIGGER','REFERENCES']) p;
select ok(not has_table_privilege(r,t,'SELECT'),r||' ohne direktes Lesen auf '||t)
from unnest(array['anon','authenticated']) r cross join unnest(array['household_invites','private.operation_results','private.invite_attempts','private.confirmed_self']) t;
select ok(not pg_has_role(r,w,'MEMBER'),r||' erbt '||w||' nicht')
from unnest(array['anon','authenticated','authenticator']) r cross join unnest(array['zaeme_reader','zaeme_writer']) w;
select ok(not rolcanlogin and not rolbypassrls and not rolsuper and not rolinherit,rolname||' eingeschränkt') from pg_roles where rolname like 'zaeme_%';
select ok(not has_schema_privilege(r,s,'CREATE'),r||' ohne CREATE auf '||s)
from unnest(array['anon','authenticated','zaeme_reader','zaeme_writer']) r cross join unnest(array['public','private']) s;
select is(count(*)::int,11,'Elf eindeutige öffentliche Einstiege')
from pg_proc where pronamespace='public'::regnamespace and proowner='zaeme_writer'::regrole;
select ok(p.prosecdef and p.proconfig @> array['search_path=""'] and not has_function_privilege('anon',p.oid,'EXECUTE')
  and has_function_privilege('authenticated',p.oid,'EXECUTE'),p.proname||' Eigentümer, Pfad und Ausführung')
from pg_proc p where p.pronamespace='public'::regnamespace and p.proowner='zaeme_writer'::regrole;
select ok(not has_function_privilege('authenticated',p.oid,'EXECUTE'),p.proname||' bleibt privat')
from pg_proc p where p.pronamespace='private'::regnamespace and p.proname not in ('eligible_actor','my_household');
select ok(p.pronargs=0 and p.prosecdef and p.proowner='zaeme_reader'::regrole and p.proconfig @> array['search_path=""']
  and not has_function_privilege('anon',p.oid,'EXECUTE'),p.proname||' parameterlos und auf eigene Identität beschränkt')
from pg_proc p where p.pronamespace='private'::regnamespace and p.proname in ('eligible_actor','my_household');
select ok(not has_column_privilege('zaeme_reader','auth.users','email','SELECT')
  and not has_column_privilege('zaeme_writer','auth.users','email_confirmed_at','SELECT'),'Funktionsbesitzer ohne direkten Auth-Datenzugriff');
select ok((select condeferrable and condeferred from pg_constraint where conname='owner_is_member'),'Owner-FK initial verschoben');

insert into auth.users(id,email_confirmed_at) values
  ('00000000-0000-4000-8000-000000000001',now()),('00000000-0000-4000-8000-000000000002',null);
select throws_ok($q$insert into profiles(id,display_name) values('00000000-0000-4000-8000-000000000001',E'\tName')$q$,'23514',null,'Profilname kanonisch');
select throws_ok($q$insert into profiles(id,display_name) values('00000000-0000-4000-8000-000000000001',repeat('😀',101))$q$,'23514',null,'101 Codepunkte abgelehnt');
insert into profiles(id,display_name) values('00000000-0000-4000-8000-000000000001',repeat('😀',100));
select throws_ok($q$insert into households(name,owner_id) values('   ','00000000-0000-4000-8000-000000000001')$q$,'23514',null,'Leerer Haushaltsname');
insert into households(id,name,owner_id) values('00000000-0000-4000-8000-000000000010','Test','00000000-0000-4000-8000-000000000001');
select throws_ok('set constraints owner_is_member immediate','23503',null,'Haushalt ohne Owner-Mitgliedschaft kann nicht committen');
insert into household_members(household_id,user_id) values('00000000-0000-4000-8000-000000000010','00000000-0000-4000-8000-000000000001');
set constraints owner_is_member immediate;
select is((select warning_days from households where id='00000000-0000-4000-8000-000000000010'),3,'Standardwarnfrist');
select throws_ok($q$update households set warning_days=-1 where id='00000000-0000-4000-8000-000000000010'$q$,'23514',null,'Negative Warnfrist');
select throws_ok($q$update households set warning_days=31 where id='00000000-0000-4000-8000-000000000010'$q$,'23514',null,'Warnfrist über 30');
select throws_ok($q$delete from auth.users where id='00000000-0000-4000-8000-000000000001'$q$,'23503',null,'Administrative Kontolöschung mit Mitgliedschaft scheitert');
select throws_ok($q$delete from household_members where user_id='00000000-0000-4000-8000-000000000001'$q$,'23503',null,'Owner bleibt Mitglied');
select throws_ok($q$insert into household_invites(household_id,token_hash) values('00000000-0000-4000-8000-000000000010','x')$q$,'23514',null,'Hashlänge geprüft');
select throws_ok($q$insert into household_members(household_id,user_id) values(gen_random_uuid(),'00000000-0000-4000-8000-000000000001')$q$,'23505',null,'Keine zweite Mitgliedschaft');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
select is(private.eligible_actor(),null::uuid,'Unbestätigte Auth-ID nicht berechtigt');
select is((public.save_profile(gen_random_uuid(),'Test',0)).code,'AUTH_REQUIRED','RPC prüft Bestätigung trotz Auth-ID');
reset role;
-- Gezielte SQLSTATE-Injektion prüft die Fehlerabbildung und den vollständigen Rollback.
-- Die echten Sperr- und Konflikttests laufen separat über HTTP.
update auth.users set email_confirmed_at=now() where id='00000000-0000-4000-8000-000000000002';
create function pg_temp.abort_profile() returns trigger language plpgsql as $$
begin raise exception using errcode='40001'; end $$;
create trigger abort_profile after insert on profiles for each row execute function pg_temp.abort_profile();
set local role authenticated;
select is((public.save_profile((lpad(to_hex(floor(extract(epoch from clock_timestamp())*1000)::bigint),12,'0')||'70008000000000000000')::uuid,'Rücknahme',0)).code,
  'RETRY','Serialisierungsfehler liefert stabilen Wiederholhinweis');
reset role;
select is((select count(*) from profiles where id='00000000-0000-4000-8000-000000000002'),0::bigint,'Keine teilweise Fachmutation');
delete from households where id='00000000-0000-4000-8000-000000000010';
select lives_ok($q$delete from auth.users where id='00000000-0000-4000-8000-000000000001'$q$,'Kontolöschung nach Auflösung möglich');
select is((select count(*) from profiles where id='00000000-0000-4000-8000-000000000001'),0::bigint,'Auth-Löschung entfernt das Profil');
select * from finish();
rollback;
