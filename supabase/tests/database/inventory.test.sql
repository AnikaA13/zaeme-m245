begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select no_plan();
select columns_are('public','inventory_items',array['id','household_id','name','quantity','unit','category','location','expiry_date','date_type','barcode','status','created_by','version','created_at','updated_at']);
select columns_are('public','reservations',array['id','household_id','inventory_item_id','user_id','quantity','created_at','updated_at']);
select col_is_pk('public','inventory_items','id','Primärschlüssel der Charge');
select col_is_pk('public','reservations','id','Primärschlüssel der Reservierung');
select ok('security_invoker=true'=any(reloptions),'Leseansicht übernimmt Rechte des Aufrufers')
  from pg_class where oid='active_inventory'::regclass;
select ok(not has_table_privilege('authenticated','active_inventory',p),'Leseansicht ohne '||p)
  from unnest(array['INSERT','UPDATE','DELETE','TRUNCATE']) p;
select ok(relrowsecurity, relname || ' mit RLS') from pg_class
  where oid in ('inventory_items'::regclass,'reservations'::regclass);
select ok(not has_table_privilege(r,t,p),r||' ohne '||p||' auf '||t)
  from unnest(array['anon','authenticated','service_role']) r
  cross join unnest(array['inventory_items','reservations']) t
  cross join unnest(array['INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) p;
select ok(not has_table_privilege('anon',t,'SELECT'),'Gast ohne Lesezugriff auf '||t)
  from unnest(array['inventory_items','reservations']) t;
select is(private.expiry_error('2029-02-28','2024-02-29','false'),null,'Fünf Kalenderjahre, Schalttag auf Monatsende');
select is(private.expiry_error('2029-03-01','2024-02-29','false'),'DATE_ACK','Erster Tag über fünf Jahren');
select is(private.expiry_error('2044-02-29','2024-02-29','true'),null,'Zwanzig Jahre inklusive');
select is(private.expiry_error('2044-03-01','2024-02-29','true'),'INVALID','Über zwanzig Jahre trotz Bestätigung');

insert into auth.users(id,email_confirmed_at)
  select ('00000000-1111-4000-8000-00000000000'||n)::uuid,now() from generate_series(1,3) n;
insert into profiles(id,display_name) select id,'Testperson' from auth.users where id::text like '00000000-1111-%';
insert into households(id,owner_id,name) select id,id,'Testhaushalt' from profiles
  where id::text like '00000000-1111-%' and right(id::text,1) <> '3';
insert into household_members(household_id,user_id) select id,owner_id from households where id::text like '00000000-1111-%';
insert into inventory_items(id,household_id,name,created_by) values
  ('00000000-1111-4000-8000-000000000010','00000000-1111-4000-8000-000000000001','Reis','00000000-1111-4000-8000-000000000003');
select throws_ok(format('update inventory_items set quantity=%L where name=''Reis''',q),'23514',null,'Ungültige Stückmenge '||q)
  from unnest(array['-1','0','0.1','10000','NaN','Infinity','-Infinity','1.0000']) q;
select ok((select quantity=1 and version=1 and status='active' and unit='Stück' and category='Sonstiges'
  and location is null and barcode is null and expiry_date is null and date_type is null from inventory_items where name='Reis'),'Vorgaben für eine neue Charge');
select throws_ok('update inventory_items set version=0 where name=''Reis''','23514',null,'Versionsnummer positiv');
select throws_ok('update inventory_items set household_id=null where name=''Reis''','23502',null,'Haushalt erforderlich');
select throws_ok('update inventory_items set category=null where name=''Reis''','23502',null,'Kategorie erforderlich');
select throws_ok('update inventory_items set expiry_date=current_date where name=''Reis''','23514',null,'Datum und Typ gehören zusammen');
select throws_ok('update inventory_items set status=''consumed'' where name=''Reis''','23514',null,'Verbraucht mit Bestand abgelehnt');
select throws_ok($q$insert into reservations(household_id,inventory_item_id,user_id,quantity)
  select m.household_id,i.id,m.user_id,1 from household_members m,inventory_items i
  where m.household_id='00000000-1111-4000-8000-000000000002' and i.name='Reis'$q$,'23503',null,'Fremde Charge ausgeschlossen');
select throws_ok($q$insert into reservations(household_id,inventory_item_id,user_id,quantity)
  select i.household_id,i.id,'00000000-1111-4000-8000-000000000002',1 from inventory_items i where i.name='Reis'$q$,
  '23503',null,'Fremde Mitgliedschaft ausgeschlossen');
insert into reservations(household_id,inventory_item_id,user_id,quantity)
  select household_id,id,household_id,1 from inventory_items where name='Reis';
select throws_ok($q$insert into reservations(household_id,inventory_item_id,user_id,quantity)
  select household_id,inventory_item_id,user_id,1 from reservations$q$,'23505',null,'Eine Reservierung pro Person und Charge');
delete from auth.users where id='00000000-1111-4000-8000-000000000003';
select ok((select created_by is null from inventory_items where name='Reis'),'Charge überlebt Löschung des Erstellers');
delete from households where id='00000000-1111-4000-8000-000000000001';
select is((select count(*) from inventory_items where name='Reis'),0::bigint,'Auflösung entfernt die Charge');
select is((select count(*) from reservations where household_id='00000000-1111-4000-8000-000000000001'),0::bigint,'Auflösung entfernt die Reservierung');
update auth.users set email_confirmed_at=null where id='00000000-1111-4000-8000-000000000002';
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-1111-4000-8000-000000000002',true);
select is((public.create_item(null,null,null,'{"name":"Reis"}','false')).code,'AUTH_REQUIRED','Anlage erfordert bestätigtes Konto');
select is((public.edit_item(null,null,null,null,'{}',1,'false')).code,'AUTH_REQUIRED','Bearbeitung erfordert bestätigtes Konto');
select is((public.consume_item(null,null,null,null,'"1"','Stück','false')).code,'AUTH_REQUIRED','Verbrauch erfordert bestätigtes Konto');
select is((public.delete_item(null,null,null,null,1,'true')).code,'AUTH_REQUIRED','Löschung erfordert bestätigtes Konto');
select is((public.set_reservation(null,null,null,null,'"1"',1)).code,'AUTH_REQUIRED','Reservierung erfordert bestätigtes Konto');
reset role;
select * from finish();
rollback;
