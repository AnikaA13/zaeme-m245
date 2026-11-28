begin;
-- Sperrt parallele Haushaltsanlagen bis zur Installation des Initialisierungstriggers.
lock table public.households in share row exclusive mode;

create table public.shopping_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households on delete cascade,
  name text not null check (name = private.clean_name(name) and char_length(name) between 1 and 100),
  quantity numeric,
  unit text,
  checked boolean not null default false,
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((quantity is null) = (unit is null)),
  check (quantity > 0 and private.valid_quantity(quantity,unit))
);
create index on public.shopping_items(household_id,checked,id);

-- Kein FK: eine aufgelöste Haushalts-ID bleibt dauerhaft belegt.
create table public.household_signals (
  id uuid primary key,
  revision bigint not null default 1 check (revision > 0)
);
alter table public.shopping_items enable row level security;
alter table public.household_signals enable row level security;
revoke all on public.shopping_items, public.household_signals from public, anon, authenticated, service_role;
grant select on public.shopping_items, public.household_signals to authenticated;
create policy members_read on public.shopping_items for select to authenticated
  using (household_id = (select private.my_household()));
create policy members_read on public.household_signals for select to authenticated
  using (id = (select private.my_household()));
grant select, delete on public.shopping_items to zaeme_writer;
grant insert (household_id,name,quantity,unit), update (name,quantity,unit,checked,version,updated_at)
  on public.shopping_items to zaeme_writer;
grant select, insert (id), update (revision) on public.household_signals to zaeme_writer;
create policy rpc_write on public.shopping_items to zaeme_writer using (true) with check (true);
create policy rpc_write on public.household_signals to zaeme_writer using (true) with check (true);

insert into public.household_signals(id) select id from public.households;

grant create on schema private to zaeme_writer;
set local role zaeme_writer;
create function private.initialize_signal() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.household_signals(id) values (new.id);
  return null;
end $$;

-- Fach-RPCs halten bereits die Haushaltszeile. Beim kaskadierten Löschen
-- bleibt die letzte Revision ruhen. Reservierungen versionieren immer die Charge.
create function private.advance_signal() returns trigger
language plpgsql security definer set search_path = '' as $$
declare h uuid;
begin
  if tg_table_name = 'profiles' then
    select m.household_id into h from public.household_members m where m.user_id=new.id;
  elsif tg_table_name = 'households' then
    h := new.id;
  elsif tg_op = 'DELETE' then
    h := old.household_id;
  else
    h := new.household_id;
    if tg_table_name = 'household_members' then
      if exists (select from public.households t where t.id=h and t.owner_id=new.user_id) then
        return null; -- Initiale Eigentümerschaft ist bereits durch Revision 1 abgedeckt.
      end if;
    end if;
  end if;
  update public.household_signals s set revision=s.revision+1
    where s.id=h and exists (select from public.households t where t.id=h);
  return null;
end $$;
reset role;
revoke create on schema private from zaeme_writer;

create trigger initialize_signal after insert on public.households
  for each row execute function private.initialize_signal();
create trigger signal_warning after update of warning_days on public.households
  for each row execute function private.advance_signal();
create trigger signal_profile after update of display_name on public.profiles
  for each row execute function private.advance_signal();
create trigger signal_members after insert or delete on public.household_members
  for each row execute function private.advance_signal();
create trigger signal_inventory after insert or update or delete on public.inventory_items
  for each row execute function private.advance_signal();
create trigger signal_shopping after insert or update or delete on public.shopping_items
  for each row execute function private.advance_signal();

-- Keine bestehende Fremdpublikation stillschweigend umkonfigurieren.
do $$
begin
  if exists (select from pg_catalog.pg_publication_tables where pubname='supabase_realtime') then
    raise exception 'Realtime-Publikation bereits belegt. Mitgliedschaft vor der Migration prüfen.';
  end if;
end $$;
alter publication supabase_realtime set (publish='update');
alter publication supabase_realtime add table only public.household_signals;
commit;
