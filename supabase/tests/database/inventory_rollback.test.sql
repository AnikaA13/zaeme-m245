begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select no_plan();

-- Drei feste IDs vereinfachen die Rollback-Prüfung. Alle Testobjekte und
-- der Fehlertrigger existieren nur innerhalb dieser Testtransaktion.
create function pg_temp.uid(n int) returns uuid language sql immutable as $$
  select ('00000000-7000-4000-8000-' || lpad(n::text,12,'0'))::uuid
$$;
create function pg_temp.op(n int) returns uuid language sql stable as $$
  select (lpad(to_hex(floor(extract(epoch from now())*1000)::bigint),12,'0') || '70008000' || lpad(n::text,12,'0'))::uuid
$$;
insert into auth.users(id,email_confirmed_at) values(pg_temp.uid(1),now()),(pg_temp.uid(2),now());
insert into profiles(id,display_name) values(pg_temp.uid(1),'A'),(pg_temp.uid(2),'B');
insert into households(id,owner_id,name) values(pg_temp.uid(3),pg_temp.uid(1),'Rücknahme');
insert into household_members(household_id,user_id,generation) values
  (pg_temp.uid(3),pg_temp.uid(1),pg_temp.uid(11)),(pg_temp.uid(3),pg_temp.uid(2),pg_temp.uid(12));
insert into inventory_items(id,household_id,name,quantity) values(pg_temp.uid(4),pg_temp.uid(3),'Milch',3);
insert into reservations(household_id,inventory_item_id,user_id,quantity) values(pg_temp.uid(3),pg_temp.uid(4),pg_temp.uid(2),2);
create function pg_temp.abort_receipt() returns trigger language plpgsql as $$
begin raise exception using errcode='40001'; end $$;
create trigger abort_receipt after insert on private.operation_results for each row execute function pg_temp.abort_receipt();

set local role authenticated;
select set_config('request.jwt.claim.sub',pg_temp.uid(2)::text,true);
select is((public.create_item(pg_temp.op(1),pg_temp.uid(3),pg_temp.uid(12),'{"name":"Zweite Charge"}','false')).code,'RETRY','Anlage vor Commit abgebrochen');
select is((public.consume_item(pg_temp.op(2),pg_temp.uid(3),pg_temp.uid(12),pg_temp.uid(4),'"2"','Stück','false')).code,'RETRY','Verbrauch nach Freigabe abgebrochen');
select is((public.set_reservation(pg_temp.op(3),pg_temp.uid(3),pg_temp.uid(12),pg_temp.uid(4),'"0"',1)).code,'RETRY','Freigabe vor Commit abgebrochen');
select is((public.leave_household(pg_temp.op(4),pg_temp.uid(3),pg_temp.uid(12),true)).code,'RETRY','Austritt vor Commit abgebrochen');
select set_config('request.jwt.claim.sub',pg_temp.uid(1)::text,true);
select is((public.remove_member(pg_temp.op(5),pg_temp.uid(3),pg_temp.uid(11),pg_temp.uid(2),pg_temp.uid(12))).code,'RETRY','Entfernung vor Commit abgebrochen');
reset role;
select is((select count(*) from inventory_items where household_id=pg_temp.uid(3)),1::bigint,'Keine teilweise angelegte Charge');
select is((select quantity from inventory_items where id=pg_temp.uid(4)),3::numeric,'Bestand zurückgerollt');
select is((select version from inventory_items where id=pg_temp.uid(4)),1::bigint,'Chargenversion zurückgerollt');
select is((select quantity from reservations where user_id=pg_temp.uid(2)),2::numeric,'Reservierung zurückgerollt');
select is((select generation from household_members where user_id=pg_temp.uid(2)),pg_temp.uid(12),'Mitgliedschaft mit gleicher Generation erhalten');
select is((select count(*) from private.operation_results where user_id in (pg_temp.uid(1),pg_temp.uid(2))),0::bigint,'Keine Erfolgsquittung');
select * from finish();
rollback;
