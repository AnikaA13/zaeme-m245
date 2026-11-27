begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select no_plan();
select columns_are('public','household_signals',array['id','revision']);
select columns_are('public','shopping_items',array['id','household_id','name','quantity','unit','checked','version','created_at','updated_at']);
select is(array(select schemaname||'.'||tablename from pg_publication_tables where pubname='supabase_realtime'),
  array['public.household_signals'],'Ausschliesslich die Signalzeile publiziert');
select ok(pubupdate and not pubinsert and not pubdelete and not pubtruncate and not puballtables,'Nur UPDATE publiziert')
  from pg_publication where pubname='supabase_realtime';
select ok(relrowsecurity,'RLS auf '||relname) from pg_class where oid in ('shopping_items'::regclass,'household_signals'::regclass);
select ok(not has_table_privilege(r,t,p),r||' ohne '||p||' auf '||t)
  from unnest(array['anon','authenticated','service_role']) r
  cross join unnest(array['shopping_items','household_signals']) t
  cross join unnest(array['INSERT','UPDATE','DELETE','TRUNCATE','TRIGGER','REFERENCES']) p;
select ok(not has_table_privilege('anon',t,'SELECT'),'Gast ohne SELECT auf '||t)
  from unnest(array['shopping_items','household_signals']) t;
insert into auth.users(id,email_confirmed_at) values ('00000000-0009-4000-8000-000000000003',now());
insert into profiles(id,display_name) values ('00000000-0009-4000-8000-000000000003','Testperson');
insert into households(id,owner_id,name) values ('00000000-0009-4000-8000-000000000003','00000000-0009-4000-8000-000000000003','Test');
insert into household_members(household_id,user_id) values ('00000000-0009-4000-8000-000000000003','00000000-0009-4000-8000-000000000003');
select is((select revision from household_signals where id='00000000-0009-4000-8000-000000000003'),1::bigint,'Initiale Zeile');
savepoint before_shopping;
insert into shopping_items(household_id,name) values ('00000000-0009-4000-8000-000000000003','Brot');
rollback to before_shopping;
select is((select revision from household_signals where id='00000000-0009-4000-8000-000000000003'),1::bigint,'Rollback nimmt Signal zurück');
select throws_ok(format($q$insert into shopping_items(household_id,name,quantity,unit) values('00000000-0009-4000-8000-000000000003','Test',%L,'kg')$q$,q),
  '23514',null,'Mengenschranke '||q) from unnest(array['NaN','Infinity','-Infinity','0','-1','10000','1.0001']) q;
insert into shopping_items(household_id,name) values ('00000000-0009-4000-8000-000000000003','Brot');
delete from households where id='00000000-0009-4000-8000-000000000003';
select is((select revision from household_signals where id='00000000-0009-4000-8000-000000000003'),2::bigint,'Auflösung lässt den Zähler ruhen');
select is((select count(*) from shopping_items where household_id='00000000-0009-4000-8000-000000000003'),0::bigint,'Auflösung löscht Einkäufe');
select throws_ok($q$insert into households(id,owner_id,name) values ('00000000-0009-4000-8000-000000000003','00000000-0009-4000-8000-000000000003','Wiederverwendung')$q$,
  '23505',null,'Verwaiste Signal-ID bleibt reserviert');
select * from finish();
rollback;
