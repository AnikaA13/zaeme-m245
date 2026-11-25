-- Ein Ergebnistyp für PostgREST. Nur die für den Aufruf relevanten Felder sind belegt.
create type public.invite_metadata as (id uuid, created_at timestamptz, expires_at timestamptz, revoked_at timestamptz);
create type public.rpc_result as (
  ok boolean, code text, id uuid, version bigint, expires_at timestamptz,
  household_name text, invites public.invite_metadata[], retry_after integer
);
create type private.operation_context as (
  actor uuid, household uuid, generation uuid, owner_id uuid, fingerprint bytea, reply public.rpc_result
);

grant create on schema public, private to zaeme_writer;
set local role zaeme_writer;
alter default privileges revoke execute on functions from public;

create function private.failure(reason text) returns public.rpc_result
language sql immutable set search_path = '' as $$
  select false, reason, null::uuid, null::bigint, null::timestamptz, null::text, null::public.invite_metadata[], null::integer
$$;
create function private.success(resource uuid, revision bigint default null, expiry timestamptz default null) returns public.rpc_result
language sql immutable set search_path = '' as $$
  select true, null::text, resource, revision, expiry, null::text, null::public.invite_metadata[], null::integer
$$;

create function private.token_digest(token text) returns bytea
language plpgsql immutable strict set search_path = '' as $$
declare raw_bytes bytea;
begin
  if octet_length(token) <> 43 or token !~ '^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$' then return null; end if;
  raw_bytes := pg_catalog.decode(pg_catalog.translate(token, '-_', '+/') || '=', 'base64');
  return pg_catalog.sha256(raw_bytes);
end $$;

create function private.operation_error(op uuid) returns text
language plpgsql volatile set search_path = '' as $$
declare issued bigint; ms bigint := floor(extract(epoch from pg_catalog.clock_timestamp()) * 1000);
begin
  if op is null or substr(op::text,15,1) <> '7' or substr(op::text,20,1) not in ('8','9','a','b') then return 'INVALID'; end if;
  issued := ('x' || left(replace(op::text,'-',''),12))::bit(48)::bigint;
  if issued < ms - 86400000 or issued > ms + 300000 then return 'OP_EXPIRED'; end if;
  return null;
end $$;

-- Pro Mutation begrenzte, indexierte Bereinigung. Nur bereits abgelaufene Fenster betreffen.
create function private.cleanup() returns void language plpgsql set search_path = '' as $$
begin
  delete from private.operation_results where (user_id, operation_id) in (
    select user_id, operation_id from private.operation_results where created_at < now() - interval '48 hours'
    order by created_at, user_id, operation_id limit 32 for update skip locked
  );
  delete from private.invite_attempts where user_id in (
    select user_id from private.invite_attempts where window_start < now() - interval '1 day'
    order by window_start, user_id limit 32 for update skip locked
  );
end $$;

create function private.start_operation(action text, op uuid, h uuid, g uuid, payload jsonb)
returns private.operation_context language plpgsql set search_path = '' as $$
declare
  c private.operation_context;
  receipt private.operation_results%rowtype;
  reason text;
  prior_household uuid;
  opening boolean := action in ('create_household','join_household');
begin
  c.actor := private.eligible_actor();
  if c.actor is null then c.reply := private.failure('AUTH_REQUIRED'); return c; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(c.actor::text, 0));
  -- Nur den eigenen aktuellen Haushalt sperren. Ein fremdes h ist kein Sperrziel.
  select m.household_id into prior_household from public.household_members m where m.user_id = c.actor;
  if prior_household is not null then
    perform from public.households t where t.id = prior_household for update;
  end if;
  select m.household_id, m.generation, t.owner_id into c.household, c.generation, c.owner_id
    from public.household_members m join public.households t on t.id = m.household_id where m.user_id = c.actor;
  if prior_household is distinct from c.household then c.reply := private.failure('FORBIDDEN'); return c; end if;
  reason := private.operation_error(op);
  if reason is not null then c.reply := private.failure(reason); return c; end if;
  c.fingerprint := pg_catalog.sha256(pg_catalog.convert_to(pg_catalog.jsonb_build_array(action,h,g,payload)::text,'UTF8'));
  select * into receipt from private.operation_results r where r.user_id = c.actor and r.operation_id = op;
  if found then
    if receipt.operation <> action or receipt.request_hash <> c.fingerprint then
      c.reply := private.failure('OP_MISMATCH'); return c;
    end if;
    if action in ('leave_household','dissolve_household') then c.reply := private.success(null); return c; end if;
    if (receipt.household_id, receipt.generation) is distinct from (c.household,c.generation) then
      c.reply := private.failure('FORBIDDEN'); return c;
    end if;
    if action in ('create_invite','revoke_invite','remove_member','set_warning_days','create_household')
       and c.owner_id is distinct from c.actor then c.reply := private.failure('FORBIDDEN'); return c; end if;
    c.reply := pg_catalog.jsonb_populate_record(null::public.rpc_result,receipt.result);
    return c;
  end if;
  if opening then
    if c.household is not null then c.reply := private.failure('ALREADY_MEMBER');
    elsif not exists (select from public.profiles p where p.id = c.actor) then c.reply := private.failure('FORBIDDEN'); end if;
  elsif (h,g) is distinct from (c.household,c.generation) or (h is null and action <> 'save_profile') then
    c.reply := private.failure('FORBIDDEN');
  elsif action in ('create_invite','revoke_invite','remove_member','dissolve_household','set_warning_days')
     and c.owner_id is distinct from c.actor then c.reply := private.failure('FORBIDDEN');
  end if;
  return c;
end $$;

create function private.finish(c private.operation_context, op uuid, action text, response public.rpc_result)
returns public.rpc_result language plpgsql set search_path = '' as $$
begin
  insert into private.operation_results(user_id,operation_id,operation,request_hash,household_id,generation,result)
    values (c.actor,op,action,c.fingerprint,c.household,c.generation,pg_catalog.jsonb_strip_nulls(pg_catalog.to_jsonb(response)));
  perform private.cleanup();
  return response;
end $$;

create function public.save_profile(op uuid,name text,v bigint,h uuid default null,g uuid default null) returns public.rpc_result
language plpgsql security definer set search_path = '' as $$
declare n text := private.clean_name(name); c private.operation_context; revision bigint;
begin
  c := private.start_operation('save_profile',op,h,g,pg_catalog.jsonb_build_array(n,v));
  if (c.reply).ok is not null then return c.reply; end if;
  if n is null or char_length(n) not between 1 and 100 or v is null or v < 0 then return private.failure('INVALID'); end if;
  if v = 0 then
    insert into public.profiles(id,display_name) values(c.actor,n) on conflict (id) do nothing returning version into revision;
  else
    update public.profiles set display_name=n, version=version+1, updated_at=pg_catalog.clock_timestamp()
      where id=c.actor and version=v returning version into revision;
  end if;
  if revision is null then return private.failure('STALE'); end if;
  return private.finish(c,op,'save_profile',private.success(c.actor,revision));
exception when deadlock_detected or serialization_failure then return private.failure('RETRY');
end $$;

create function public.create_household(op uuid,name text) returns public.rpc_result
language plpgsql security definer set search_path = '' as $$
declare n text := private.clean_name(name); c private.operation_context;
begin
  c := private.start_operation('create_household',op,null,null,pg_catalog.to_jsonb(n));
  if (c.reply).ok is not null then return c.reply; end if;
  if n is null or char_length(n) not between 1 and 100 then return private.failure('INVALID'); end if;
  insert into public.households(name,owner_id,created_by) values(n,c.actor,c.actor) returning id into c.household;
  insert into public.household_members(household_id,user_id) values(c.household,c.actor) returning generation into c.generation;
  return private.finish(c,op,'create_household',private.success(c.household));
exception when deadlock_detected or serialization_failure then return private.failure('RETRY');
end $$;

create function public.create_invite(op uuid,h uuid,g uuid,hash bytea) returns public.rpc_result
language plpgsql security definer set search_path = '' as $$
declare c private.operation_context; invite public.household_invites%rowtype;
begin
  c := private.start_operation('create_invite',op,h,g,pg_catalog.to_jsonb(pg_catalog.encode(hash,'hex')));
  if (c.reply).ok is not null then return c.reply; end if;
  if hash is null or octet_length(hash) <> 32 then return private.failure('INVALID'); end if;
  insert into public.household_invites(household_id,token_hash,created_by) values(h,hash,c.actor)
    on conflict (token_hash) do nothing returning * into invite;
  if not found then return private.failure('HASH_EXISTS'); end if;
  return private.finish(c,op,'create_invite',private.success(invite.id,null,invite.expires_at));
exception when deadlock_detected or serialization_failure then return private.failure('RETRY');
end $$;

create function public.list_invites(h uuid) returns public.rpc_result
language sql stable security definer set search_path = '' as $$
  select case when a.id is null then private.failure('AUTH_REQUIRED')
    when exists (select from public.households t where t.id=h and t.owner_id=a.id)
    then (true,null,null,null,null,null,array(
      select row(i.id,i.created_at,i.expires_at,i.revoked_at)::public.invite_metadata
      from public.household_invites i where i.household_id=h order by i.created_at desc,i.id
    ),null)::public.rpc_result else private.failure('FORBIDDEN') end
  from (select private.eligible_actor() as id) a
$$;
create function public.revoke_invite(op uuid,h uuid,g uuid,id uuid) returns public.rpc_result
language plpgsql security definer set search_path = '' as $$
declare c private.operation_context;
begin
  c := private.start_operation('revoke_invite',op,h,g,pg_catalog.to_jsonb(id));
  if (c.reply).ok is not null then return c.reply; end if;
  update public.household_invites i set revoked_at=coalesce(i.revoked_at,pg_catalog.clock_timestamp())
    where i.id=revoke_invite.id and i.household_id=h;
  if not found then return private.failure('NOT_FOUND'); end if;
  return private.finish(c,op,'revoke_invite',private.success(id));
exception when deadlock_detected or serialization_failure then return private.failure('RETRY');
end $$;

-- Aufrufer hält bereits die Kontosperre. Fehler als Ergebnis zurückgeben, damit das Budget committet.
create function private.use_attempt(actor uuid) returns integer language plpgsql set search_path = '' as $$
declare ts timestamptz := pg_catalog.clock_timestamp(); started timestamptz;
begin
  insert into private.invite_attempts as a values(actor,ts,1)
    on conflict (user_id) do update set
      attempts=case when a.window_start <= ts-interval '10 minutes' then 1 else a.attempts+1 end,
      window_start=case when a.window_start <= ts-interval '10 minutes' then ts else a.window_start end
    where a.attempts < 20 or a.window_start <= ts-interval '10 minutes';
  if found then return 0; end if;
  select window_start into started from private.invite_attempts where user_id=actor;
  return greatest(1,ceil(extract(epoch from started+interval '10 minutes'-ts))::int);
end $$;

create function public.preview_invite(token text) returns public.rpc_result
language plpgsql security definer set search_path = '' as $$
declare actor uuid := private.eligible_actor(); r public.rpc_result; wait_seconds integer;
begin
  if actor is null then return private.failure('AUTH_REQUIRED'); end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor::text,0));
  if exists(select from public.household_members where user_id=actor) then return private.failure('ALREADY_MEMBER'); end if;
  wait_seconds := private.use_attempt(actor);
  if wait_seconds > 0 then r := private.failure('RATE_LIMITED'); r.retry_after := wait_seconds; return r; end if;
  perform private.cleanup();
  select t.name into r.household_name from public.household_invites i join public.households t on t.id=i.household_id
    where i.token_hash=private.token_digest(token) and i.revoked_at is null and i.expires_at>pg_catalog.clock_timestamp();
  if not found then return private.failure('INVITE_INVALID'); end if;
  r.ok := true; return r;
exception when deadlock_detected or serialization_failure then return private.failure('RETRY');
end $$;

create function public.join_household(op uuid,token text) returns public.rpc_result
language plpgsql security definer set search_path = '' as $$
declare digest bytea := private.token_digest(token); c private.operation_context; wait_seconds integer; r public.rpc_result;
begin
  c := private.start_operation('join_household',op,null,null,pg_catalog.to_jsonb(pg_catalog.encode(digest,'hex')));
  if (c.reply).ok is not null then return c.reply; end if;
  wait_seconds := private.use_attempt(c.actor);
  if wait_seconds>0 then r := private.failure('RATE_LIMITED'); r.retry_after := wait_seconds; return r; end if;
  select i.household_id into c.household from public.household_invites i where i.token_hash=digest;
  perform from public.households t where t.id=c.household for update;
  if not found then perform private.cleanup(); return private.failure('INVITE_INVALID'); end if;
  perform from public.household_invites i where i.household_id=c.household and i.token_hash=digest for update;
  if not exists(select from public.household_invites i where i.household_id=c.household and i.token_hash=digest
    and i.revoked_at is null and i.expires_at>pg_catalog.clock_timestamp()) then perform private.cleanup(); return private.failure('INVITE_INVALID'); end if;
  if private.operation_error(op) is not null then return private.failure('OP_EXPIRED'); end if;
  if exists(select from public.household_members m where m.user_id=c.actor) then return private.failure('ALREADY_MEMBER'); end if;
  insert into public.household_members(household_id,user_id) values(c.household,c.actor) returning generation into c.generation;
  return private.finish(c,op,'join_household',private.success(c.household));
exception when deadlock_detected or serialization_failure then return private.failure('RETRY');
end $$;

create function public.leave_household(op uuid,h uuid,g uuid,confirm boolean) returns public.rpc_result
language plpgsql security definer set search_path = '' as $$
declare c private.operation_context;
begin
  c := private.start_operation('leave_household',op,h,g,pg_catalog.to_jsonb(confirm));
  if (c.reply).ok is not null then return c.reply; end if;
  if confirm is not true then return private.failure('CONFIRM_REQUIRED'); end if;
  if c.actor=c.owner_id then return private.failure('OWNER_BOUND'); end if;
  delete from public.household_members where household_id=h and user_id=c.actor;
  return private.finish(c,op,'leave_household',private.success(null));
exception when deadlock_detected or serialization_failure then return private.failure('RETRY');
end $$;
create function public.remove_member(op uuid,h uuid,g uuid,target uuid,target_g uuid) returns public.rpc_result
language plpgsql security definer set search_path = '' as $$
declare c private.operation_context;
begin
  c := private.start_operation('remove_member',op,h,g,pg_catalog.jsonb_build_array(target,target_g));
  if (c.reply).ok is not null then return c.reply; end if;
  if target=c.actor then return private.failure('OWNER_BOUND'); end if;
  delete from public.household_members where household_id=h and user_id=target and generation=target_g;
  if not found then return private.failure('NOT_FOUND'); end if;
  return private.finish(c,op,'remove_member',private.success(target));
exception when deadlock_detected or serialization_failure then return private.failure('RETRY');
end $$;
create function public.dissolve_household(op uuid,h uuid,g uuid,confirm boolean) returns public.rpc_result
language plpgsql security definer set search_path = '' as $$
declare c private.operation_context;
begin
  c := private.start_operation('dissolve_household',op,h,g,pg_catalog.to_jsonb(confirm));
  if (c.reply).ok is not null then return c.reply; end if;
  if confirm is not true then return private.failure('CONFIRM_REQUIRED'); end if;
  if exists(select from public.household_members where household_id=h and user_id<>c.actor) then return private.failure('OWNER_BOUND'); end if;
  delete from public.households where id=h;
  return private.finish(c,op,'dissolve_household',private.success(null));
exception when deadlock_detected or serialization_failure then return private.failure('RETRY');
end $$;
create function public.set_warning_days(op uuid,h uuid,g uuid,days jsonb,v bigint) returns public.rpc_result
language plpgsql security definer set search_path = '' as $$
declare c private.operation_context; n numeric; revision bigint;
begin
  if pg_catalog.jsonb_typeof(days)='number' then n := (days::text)::numeric; end if;
  c := private.start_operation('set_warning_days',op,h,g,pg_catalog.jsonb_build_array(case when n is null then days else pg_catalog.to_jsonb(pg_catalog.trim_scale(n)) end,v));
  if (c.reply).ok is not null then return c.reply; end if;
  if n is null or n not between 0 and 30 or n<>trunc(n) or v is null or v<1 then return private.failure('INVALID'); end if;
  update public.households set warning_days=n::integer, version=version+1, updated_at=pg_catalog.clock_timestamp()
    where id=h and version=v returning version into revision;
  if not found then return private.failure('STALE'); end if;
  return private.finish(c,op,'set_warning_days',private.success(h,revision));
exception when deadlock_detected or serialization_failure then return private.failure('RETRY');
end $$;

reset role;
revoke create on schema public, private from zaeme_writer;
-- Für die Zeilensperre der begrenzten Quittungsbereinigung.
grant update (created_at) on private.operation_results to zaeme_writer;
grant execute on function
  public.save_profile(uuid,text,bigint,uuid,uuid), public.create_household(uuid,text),
  public.create_invite(uuid,uuid,uuid,bytea), public.list_invites(uuid),
  public.revoke_invite(uuid,uuid,uuid,uuid), public.preview_invite(text), public.join_household(uuid,text),
  public.leave_household(uuid,uuid,uuid,boolean), public.remove_member(uuid,uuid,uuid,uuid,uuid),
  public.dissolve_household(uuid,uuid,uuid,boolean), public.set_warning_days(uuid,uuid,uuid,jsonb,bigint)
  to authenticated;
