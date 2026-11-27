grant create on schema public, private to zaeme_writer;
set local role zaeme_writer;

-- Vor dem Cast Typ und Dezimalsyntax prüfen. Insbesondere darf PostgREST keine
-- JSON-Zahl, Exponentialschreibweise oder Bestätigung als Text umdeuten.
create function private.decimal_input(value jsonb) returns numeric
language plpgsql immutable strict set search_path = '' as $$
declare s text := value #>> '{}';
begin
  if jsonb_typeof(value) <> 'string' or s !~ '^[0-9]+([.][0-9]{1,3})?$' then return null; end if;
  s := ltrim(s,'0');
  if length(split_part(s,'.',1)) > 4 then return null; end if;
  return trim_scale(('0' || s)::numeric);
end $$;

-- Pflichtwerte und Defaults nur bei der Anlage ergänzen. Bei der Bearbeitung
-- bezeichnet NULL im vollständigen Feldsatz das bewusste Leeren eines Felds.
create function private.normalized_item(fields jsonb, creating boolean) returns jsonb
language plpgsql immutable set search_path = '' as $$
declare
  keys constant text[] := array['name','quantity','unit','category','location','expiry_date','date_type','barcode'];
  f jsonb := fields;
  q numeric;
  n text;
  d text;
begin
  if jsonb_typeof(f) is distinct from 'object' then return null; end if;
  if f - keys <> '{}'::jsonb then return null; end if;
  if creating then
    f := '{"quantity":"1","unit":"Stück","category":"Sonstiges","location":null,"expiry_date":null,"date_type":null,"barcode":null}'::jsonb || f;
  end if;
  if not (f ?& keys) or exists (
    select from jsonb_each(f) e where jsonb_typeof(e.value) not in ('string','null')
  ) then return null; end if;
  n := private.clean_name(f->>'name');
  q := private.decimal_input(f->'quantity');
  d := f->>'expiry_date';
  if n is null or char_length(n) not between 1 and 100 or q is null or q <= 0
    or private.valid_quantity(q,f->>'unit') is not true
    or private.valid_item_unit(f->>'category',f->>'unit') is not true
    or (d is null) <> ((f->>'date_type') is null)
    or (d is not null and (d !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or not pg_input_is_valid(d,'date')))
  then return null; end if;
  return f || jsonb_build_object('name',n,'quantity',q::text);
end $$;

create function private.expiry_error(expiry date, today date, acknowledged jsonb) returns text
language sql immutable set search_path = '' as $$
  select case when expiry > today + interval '20 years' then 'INVALID'
    when expiry > today + interval '5 years' and acknowledged is distinct from 'true'::jsonb then 'DATE_ACK' end
$$;

create function private.lock_item(h uuid, item_id uuid) returns public.inventory_items
language sql volatile set search_path = '' as $$
  select i.* from public.inventory_items i where i.household_id=h and i.id=item_id for update
$$;

create function private.write_item(creating boolean, op uuid, h uuid, g uuid, item_id uuid, fields jsonb, v bigint, ack jsonb)
returns public.rpc_result language plpgsql set search_path = '' as $$
declare
  action text := case when creating then 'create_item' else 'edit_item' end;
  f jsonb := private.normalized_item(fields,creating);
  c private.operation_context;
  previous public.inventory_items;
  item public.inventory_items;
  reserved numeric;
  reason text;
begin
  c := private.start_operation(action,op,h,g,jsonb_build_array(item_id,coalesce(f,fields),v,ack));
  if (c.reply).ok is not null then return c.reply; end if;
  if f is null or jsonb_typeof(ack) is distinct from 'boolean'
     or (not creating and (v is null or v < 1 or item_id is null)) then return private.failure('INVALID'); end if;
  item := jsonb_populate_record(null::public.inventory_items,f);
  if not creating then
    previous := private.lock_item(h,item_id);
    if previous.id is null then return private.failure('NOT_FOUND'); end if;
    if previous.version <> v or previous.status <> 'active' then return private.failure('STALE'); end if;
    select coalesce(sum(r.quantity),0) into reserved from public.reservations r where r.inventory_item_id=item_id;
    if item.quantity < reserved or (reserved > 0 and (item.unit,item.category) <> (previous.unit,previous.category))
      then return private.failure('RESERVED'); end if;
  end if;
  if item.expiry_date is distinct from previous.expiry_date then
    reason := private.expiry_error(item.expiry_date,(clock_timestamp() at time zone 'Europe/Zurich')::date,ack);
    if reason is not null then return private.failure(reason); end if;
  end if;
  if creating then
    insert into public.inventory_items(household_id,name,quantity,unit,category,location,expiry_date,date_type,barcode,created_by)
      values(h,item.name,item.quantity,item.unit,item.category,item.location,item.expiry_date,item.date_type,item.barcode,c.actor)
      returning id,version into item.id,item.version;
  else
    update public.inventory_items i set name=item.name,quantity=item.quantity,unit=item.unit,category=item.category,
      location=item.location,expiry_date=item.expiry_date,date_type=item.date_type,barcode=item.barcode,
      version=i.version+1,updated_at=clock_timestamp() where i.id=item_id returning i.id,i.version into item.id,item.version;
  end if;
  return private.finish(c,op,action,private.success(item.id,item.version));
exception when check_violation then return private.failure('INVALID');
  when deadlock_detected or serialization_failure then return private.failure('RETRY');
end $$;

create function public.create_item(op uuid,h uuid,g uuid,fields jsonb,ack jsonb) returns public.rpc_result
language sql volatile security definer set search_path = '' as $$
  select private.write_item(true,op,h,g,null,fields,null,ack)
$$;
create function public.edit_item(op uuid,h uuid,g uuid,id uuid,fields jsonb,v bigint,ack jsonb) returns public.rpc_result
language sql volatile security definer set search_path = '' as $$
  select private.write_item(false,op,h,g,id,fields,v,ack)
$$;

create function public.set_reservation(op uuid,h uuid,g uuid,id uuid,desired jsonb,v bigint) returns public.rpc_result
language plpgsql security definer set search_path = '' as $$
declare
  c private.operation_context;
  item public.inventory_items;
  q numeric := private.decimal_input(desired);
  foreign_sum numeric;
  own numeric;
begin
  c := private.start_operation('set_reservation',op,h,g,jsonb_build_array(id,coalesce(to_jsonb(q::text),desired),v));
  if (c.reply).ok is not null then return c.reply; end if;
  if id is null or q is null or v is null or v < 1 then return private.failure('INVALID'); end if;
  item := private.lock_item(h,id);
  if item.id is null then return private.failure('NOT_FOUND'); end if;
  if item.version <> v or item.status <> 'active' then return private.failure('STALE'); end if;
  if not private.valid_quantity(q,item.unit) then return private.failure('INVALID'); end if;
  select coalesce(sum(r.quantity) filter(where r.user_id<>c.actor),0),
         coalesce(max(r.quantity) filter(where r.user_id=c.actor),0)
    into foreign_sum,own from public.reservations r where r.inventory_item_id=item.id;
  if q > item.quantity-foreign_sum then return private.failure('INSUFFICIENT'); end if;
  if q <> own then
    if q = 0 then
      delete from public.reservations r where r.inventory_item_id=item.id and r.user_id=c.actor;
    else
      insert into public.reservations(household_id,inventory_item_id,user_id,quantity) values(h,item.id,c.actor,q)
        on conflict (inventory_item_id,user_id) do update set quantity=excluded.quantity,updated_at=clock_timestamp();
    end if;
    update public.inventory_items i set version=i.version+1,updated_at=clock_timestamp()
      where i.id=item.id returning i.version into item.version;
  end if;
  return private.finish(c,op,'set_reservation',private.success(item.id,item.version));
exception when deadlock_detected or serialization_failure then return private.failure('RETRY');
end $$;

create function public.consume_item(op uuid,h uuid,g uuid,id uuid,amount jsonb,unit text,confirm_full jsonb,confirmed_v bigint default null)
returns public.rpc_result language plpgsql security definer set search_path = '' as $$
declare
  c private.operation_context;
  item public.inventory_items;
  q numeric := private.decimal_input(amount);
  foreign_sum numeric;
begin
  c := private.start_operation('consume_item',op,h,g,jsonb_build_array(id,coalesce(to_jsonb(q::text),amount),unit,confirm_full,confirmed_v));
  if (c.reply).ok is not null then return c.reply; end if;
  if id is null or q is null or q <= 0 or unit is null or jsonb_typeof(confirm_full) is distinct from 'boolean'
     then return private.failure('INVALID'); end if;
  item := private.lock_item(h,id);
  if item.id is null then return private.failure('NOT_FOUND'); end if;
  if item.unit <> unit then return private.failure('STALE'); end if;
  if confirm_full = 'true'::jsonb then
    if confirmed_v is null then return private.failure('CONFIRM_FULL'); end if;
    if confirmed_v <> item.version or q <> item.quantity then return private.failure('STALE'); end if;
  elsif confirmed_v is not null then return private.failure('INVALID'); end if;
  if not private.valid_quantity(q,item.unit) then return private.failure('INVALID'); end if;
  select coalesce(sum(r.quantity),0) into foreign_sum from public.reservations r
    where r.inventory_item_id=item.id and r.user_id<>c.actor;
  if q > item.quantity-foreign_sum then return private.failure('INSUFFICIENT'); end if;
  if q = item.quantity and confirm_full <> 'true'::jsonb then return private.failure('CONFIRM_FULL'); end if;
  delete from public.reservations r where r.inventory_item_id=item.id and r.user_id=c.actor and r.quantity <= q;
  if not found then
    update public.reservations r set quantity=r.quantity-q,updated_at=clock_timestamp()
      where r.inventory_item_id=item.id and r.user_id=c.actor;
  end if;
  update public.inventory_items i set quantity=i.quantity-q,
    status=case when i.quantity=q then 'consumed' else 'active' end,
    version=i.version+1,updated_at=clock_timestamp() where i.id=item.id returning i.version into item.version;
  return private.finish(c,op,'consume_item',private.success(item.id,item.version));
exception when deadlock_detected or serialization_failure then return private.failure('RETRY');
end $$;

create function public.delete_item(op uuid,h uuid,g uuid,id uuid,v bigint,confirm jsonb)
returns public.rpc_result language plpgsql security definer set search_path = '' as $$
declare c private.operation_context; item public.inventory_items;
begin
  c := private.start_operation('delete_item',op,h,g,jsonb_build_array(id,v,confirm));
  if (c.reply).ok is not null then return c.reply; end if;
  if id is null or v is null or v < 1 or jsonb_typeof(confirm) is distinct from 'boolean' then return private.failure('INVALID'); end if;
  if confirm <> 'true'::jsonb then return private.failure('CONFIRM_REQUIRED'); end if;
  item := private.lock_item(h,id);
  if item.id is null then return private.failure('NOT_FOUND'); end if;
  if item.version <> v or item.status <> 'active' then return private.failure('STALE'); end if;
  if exists(select from public.reservations r where r.inventory_item_id=item.id) then return private.failure('RESERVED'); end if;
  delete from public.inventory_items i where i.id=item.id;
  return private.finish(c,op,'delete_item',private.success(item.id));
exception when deadlock_detected or serialization_failure then return private.failure('RETRY');
end $$;

-- Die Haushaltszeile ist durch start_operation bereits gesperrt. Beim Austritt
-- alle betroffenen Chargen in UUID-Reihenfolge vor den Reservierungen sperren.
create function private.release_member_stock(h uuid, member_id uuid) returns void
language plpgsql set search_path = '' as $$
begin
  perform from public.inventory_items i join public.reservations r on i.id=r.inventory_item_id
    where r.household_id=h and r.user_id=member_id order by i.id for update of i;
  with released as (
    delete from public.reservations r where r.household_id=h and r.user_id=member_id returning r.inventory_item_id
  )
  update public.inventory_items i set version=i.version+1,updated_at=clock_timestamp()
    from released where i.id=released.inventory_item_id;
end $$;
create or replace function public.leave_household(op uuid,h uuid,g uuid,confirm boolean) returns public.rpc_result
language plpgsql security definer set search_path = '' as $$
declare c private.operation_context;
begin
  c := private.start_operation('leave_household',op,h,g,pg_catalog.to_jsonb(confirm));
  if (c.reply).ok is not null then return c.reply; end if;
  if confirm is not true then return private.failure('CONFIRM_REQUIRED'); end if;
  if c.actor=c.owner_id then return private.failure('OWNER_BOUND'); end if;
  perform private.release_member_stock(h,c.actor);
  delete from public.household_members where household_id=h and user_id=c.actor;
  return private.finish(c,op,'leave_household',private.success(null));
exception when deadlock_detected or serialization_failure then return private.failure('RETRY');
end $$;
create or replace function public.remove_member(op uuid,h uuid,g uuid,target uuid,target_g uuid) returns public.rpc_result
language plpgsql security definer set search_path = '' as $$
declare c private.operation_context;
begin
  c := private.start_operation('remove_member',op,h,g,pg_catalog.jsonb_build_array(target,target_g));
  if (c.reply).ok is not null then return c.reply; end if;
  if target=c.actor then return private.failure('OWNER_BOUND'); end if;
  if not exists(select from public.household_members where household_id=h and user_id=target and generation=target_g) then return private.failure('NOT_FOUND'); end if;
  perform private.release_member_stock(h,target);
  delete from public.household_members where household_id=h and user_id=target and generation=target_g;
  if not found then return private.failure('NOT_FOUND'); end if;
  return private.finish(c,op,'remove_member',private.success(target));
exception when deadlock_detected or serialization_failure then return private.failure('RETRY');
end $$;

reset role;
revoke create on schema public, private from zaeme_writer;
grant execute on function public.create_item(uuid,uuid,uuid,jsonb,jsonb),
  public.edit_item(uuid,uuid,uuid,uuid,jsonb,bigint,jsonb),
  public.set_reservation(uuid,uuid,uuid,uuid,jsonb,bigint),
  public.consume_item(uuid,uuid,uuid,uuid,jsonb,text,jsonb,bigint),
  public.delete_item(uuid,uuid,uuid,uuid,bigint,jsonb) to authenticated;
