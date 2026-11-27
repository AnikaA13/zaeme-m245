grant create on schema public, private to zaeme_writer;
set local role zaeme_writer;

create function private.normalized_shopping(fields jsonb, creating boolean) returns jsonb
language plpgsql immutable set search_path = '' as $$
declare
  keys constant text[] := array['name','quantity','unit'];
  f jsonb := fields;
  n text;
  q numeric;
begin
  if jsonb_typeof(f) is distinct from 'object' or f - keys <> '{}'::jsonb then return null; end if;
  if creating then f := '{"quantity":null,"unit":null}'::jsonb || f; end if;
  if not (f ?& keys) or jsonb_typeof(f->'name') <> 'string' then return null; end if;
  n := private.clean_name(f->>'name');
  if char_length(n) not between 1 and 100 then return null; end if;
  if f->'quantity' <> 'null'::jsonb or f->'unit' <> 'null'::jsonb then
    q := private.decimal_input(f->'quantity');
    if q is null or q <= 0 or private.valid_quantity(q,f->>'unit') is not true then return null; end if;
  end if;
  return jsonb_build_object('name',n,'quantity',q::text,'unit',f->>'unit');
end $$;

create function private.write_shopping(action text, op uuid, h uuid, g uuid,
  item_id uuid, fields jsonb, desired jsonb, v bigint) returns public.rpc_result
language plpgsql set search_path = '' as $$
declare
  normalized jsonb;
  c private.operation_context;
  item public.shopping_items;
  receipt public.rpc_result;
begin
  if action in ('create_shopping','edit_shopping') then
    normalized := private.normalized_shopping(fields, action='create_shopping');
  end if;
  c := private.start_operation(action,op,h,g,jsonb_build_array(item_id,coalesce(normalized,fields),desired,v));
  if (c.reply).ok is not null then return c.reply; end if;
  if action in ('create_shopping','edit_shopping') and normalized is null then return private.failure('INVALID'); end if;
  if action='check_shopping' and jsonb_typeof(desired) is distinct from 'boolean' then return private.failure('INVALID'); end if;
  if action <> 'create_shopping' then
    if item_id is null or v is null or v < 1 then return private.failure('INVALID'); end if;
    select s.* into item from public.shopping_items s where s.household_id=h and s.id=item_id for update;
    if not found then return private.failure('NOT_FOUND'); end if;
    if item.version <> v then return private.failure('STALE'); end if;
  end if;
  case action
    when 'create_shopping' then
      insert into public.shopping_items(household_id,name,quantity,unit)
        values (h,normalized->>'name',(normalized->>'quantity')::numeric,normalized->>'unit')
        returning * into item;
    when 'edit_shopping' then
      if (item.name,item.quantity,item.unit) is distinct from
         (normalized->>'name',(normalized->>'quantity')::numeric,normalized->>'unit') then
        update public.shopping_items s set name=normalized->>'name', quantity=(normalized->>'quantity')::numeric,
          unit=normalized->>'unit',version=s.version+1,updated_at=clock_timestamp()
          where s.id=item_id returning * into item;
      end if;
    when 'check_shopping' then
      if item.checked <> desired::boolean then
        update public.shopping_items s set checked=desired::boolean,version=s.version+1,updated_at=clock_timestamp()
          where s.id=item_id returning * into item;
      end if;
    when 'delete_shopping' then
      delete from public.shopping_items s where s.id=item_id;
      item.version := null;
  end case;
  receipt := private.success(item.id,item.version);
  return private.finish(c,op,action,receipt);
exception when deadlock_detected or serialization_failure then return private.failure('RETRY');
end $$;

create function public.create_shopping(op uuid,h uuid,g uuid,fields jsonb) returns public.rpc_result
language sql volatile security definer set search_path = '' as $$
  select private.write_shopping('create_shopping',op,h,g,null,fields,null,null)
$$;
create function public.edit_shopping(op uuid,h uuid,g uuid,id uuid,fields jsonb,v bigint) returns public.rpc_result
language sql volatile security definer set search_path = '' as $$
  select private.write_shopping('edit_shopping',op,h,g,id,fields,null,v)
$$;
-- JSONB bewahrt den Transporttyp. Nur ein echtes JSON-Boolean ist zulässig.
create function public.check_shopping(op uuid,h uuid,g uuid,id uuid,checked jsonb,v bigint) returns public.rpc_result
language sql volatile security definer set search_path = '' as $$
  select private.write_shopping('check_shopping',op,h,g,id,null,checked,v)
$$;
create function public.delete_shopping(op uuid,h uuid,g uuid,id uuid,v bigint) returns public.rpc_result
language sql volatile security definer set search_path = '' as $$
  select private.write_shopping('delete_shopping',op,h,g,id,null,null,v)
$$;
reset role;
revoke create on schema public, private from zaeme_writer;
grant execute on function public.create_shopping(uuid,uuid,uuid,jsonb),
  public.edit_shopping(uuid,uuid,uuid,uuid,jsonb,bigint),
  public.check_shopping(uuid,uuid,uuid,uuid,jsonb,bigint),
  public.delete_shopping(uuid,uuid,uuid,uuid,bigint) to authenticated;
