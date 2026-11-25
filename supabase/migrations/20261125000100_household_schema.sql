-- Lesende Identitätsprüfung und schreibende RPCs besitzen keine Tabellen.
create role zaeme_reader nologin noinherit nobypassrls;
create role zaeme_writer nologin noinherit nobypassrls;
grant zaeme_reader, zaeme_writer to postgres;
create schema private;
revoke all on schema private from public, anon, authenticated;
revoke create on schema public from public, anon, authenticated;
grant usage on schema private, public, auth to zaeme_reader, zaeme_writer;
grant usage on schema private to authenticated;
-- postgres darf Auth-Daten lesen, hat aber kein GRANT OPTION auf auth.users.
-- Die geschlossene Sicht gibt höchstens die eigene bestätigte ID weiter.
create view private.confirmed_self with (security_barrier = true) as
  select u.id from auth.users u where u.id = auth.uid() and u.email_confirmed_at is not null;
alter view private.confirmed_self owner to postgres;
revoke all on private.confirmed_self from public, anon, authenticated, service_role;
grant select on private.confirmed_self to zaeme_reader;

create function private.clean_name(value text) returns text
language sql immutable strict set search_path = '' as $$
  select pg_catalog.btrim(value, U&'\0009\000A\000B\000C\000D\0020\0085\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF')
$$;

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text not null check (display_name = private.clean_name(display_name) and char_length(display_name) between 1 and 100),
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (name = private.clean_name(name) and char_length(name) between 1 and 100),
  owner_id uuid not null,
  created_by uuid references public.profiles on delete set null,
  warning_days integer not null default 3 check (warning_days between 0 and 30),
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.household_members (
  household_id uuid not null references public.households on delete cascade,
  user_id uuid not null unique references public.profiles on delete restrict,
  generation uuid not null default gen_random_uuid(),
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);
alter table public.households add constraint owner_is_member
  foreign key (id, owner_id) references public.household_members (household_id, user_id)
  on delete no action deferrable initially deferred;

create table public.household_invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households on delete cascade,
  token_hash bytea not null unique check (octet_length(token_hash) = 32),
  created_by uuid references public.profiles on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  revoked_at timestamptz,
  check (expires_at > created_at),
  check (revoked_at >= created_at)
);
create index on public.household_invites (household_id, created_at);

create table private.operation_results (
  user_id uuid not null references public.profiles on delete cascade,
  operation_id uuid not null,
  operation text not null,
  request_hash bytea not null check (octet_length(request_hash) = 32),
  household_id uuid,
  generation uuid,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, operation_id)
);
create index on private.operation_results (created_at);
create table private.invite_attempts (
  user_id uuid primary key references auth.users on delete cascade,
  window_start timestamptz not null,
  attempts integer not null check (attempts between 1 and 20)
);
create index on private.invite_attempts (window_start);

alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.household_invites enable row level security;
alter table private.operation_results enable row level security;
alter table private.invite_attempts enable row level security;
revoke all on public.profiles, public.households, public.household_members, public.household_invites,
  private.operation_results, private.invite_attempts from public, anon, authenticated, service_role;
grant select on public.profiles, public.households, public.household_members to authenticated;
grant select on public.household_members to zaeme_reader;
create policy lookup_membership on public.household_members for select to zaeme_reader using (user_id = (select auth.uid()));
create function private.eligible_actor() returns uuid
language sql stable security definer set search_path = '' as $$
  select id from private.confirmed_self
$$;
create function private.my_household() returns uuid
language sql stable security definer set search_path = '' as $$
  select m.household_id from public.household_members m where m.user_id = private.eligible_actor()
$$;
grant create on schema private to zaeme_reader;
alter function private.eligible_actor() owner to zaeme_reader;
alter function private.my_household() owner to zaeme_reader;
revoke create on schema private from zaeme_reader;

create policy members_read on public.household_members for select to authenticated
  using (household_id = (select private.my_household()));
create policy household_read on public.households for select to authenticated
  using (id = (select private.my_household()));
create policy profiles_read on public.profiles for select to authenticated
  using (id = (select private.eligible_actor()) or exists (
    select from public.household_members m where m.user_id = profiles.id and m.household_id = (select private.my_household())
  ));

grant select, insert on public.profiles, public.households, public.household_members, public.household_invites to zaeme_writer;
grant update (display_name, version, updated_at) on public.profiles to zaeme_writer;
grant update (warning_days, version, updated_at), delete on public.households to zaeme_writer;
grant delete on public.household_members to zaeme_writer;
grant update (revoked_at) on public.household_invites to zaeme_writer;
grant select, insert, delete on private.operation_results to zaeme_writer;
grant select, insert, update, delete on private.invite_attempts to zaeme_writer;
create policy rpc_write on public.profiles to zaeme_writer using (true) with check (true);
create policy rpc_write on public.households to zaeme_writer using (true) with check (true);
create policy rpc_write on public.household_members to zaeme_writer using (true) with check (true);
create policy rpc_write on public.household_invites to zaeme_writer using (true) with check (true);
create policy rpc_write on private.operation_results to zaeme_writer using (true) with check (true);
create policy rpc_write on private.invite_attempts to zaeme_writer using (true) with check (true);

revoke all on all functions in schema private from public, anon, authenticated, service_role;
grant execute on function private.eligible_actor(), private.my_household() to authenticated;
grant execute on function private.eligible_actor(), private.clean_name(text) to zaeme_writer;
