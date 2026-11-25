-- Zeitunabhängige Schranken gelten auch für interne Schreibzugriffe.
grant create on schema private to zaeme_writer;
set local role zaeme_writer;
create function private.valid_ean13(barcode text) returns boolean
language sql immutable strict set search_path = '' as $$
  select case when barcode ~ '^[0-9]{13}$' then
    (select sum(substr(barcode,i,1)::int * case when i % 2 = 0 then 3 else 1 end) % 10 = 0
       from generate_series(1,13) i)
    else false end
$$;

create function private.valid_item_unit(category text, unit text) returns boolean
language sql immutable strict set search_path = '' as $$
  select case
    when category in ('Früchte/Gemüse','Fleisch/Fisch','Brot/Backwaren','Trockenwaren') then unit in ('Stück','Packung','kg')
    when category = 'Getränke' then unit in ('Stück','Packung','Liter')
    when category in ('Milchprodukte','Sonstiges') then unit in ('Stück','Packung','kg','Liter')
    else false end
$$;

create function private.valid_quantity(q numeric, unit text) returns boolean
language sql immutable strict set search_path = '' as $$
  select q between 0 and 9999 and scale(q) <= 3
    and (unit in ('kg','Liter') or (unit in ('Stück','Packung') and q = trunc(q)))
$$;
reset role;
revoke create on schema private from zaeme_writer;

create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households on delete cascade,
  name text not null check (name = private.clean_name(name) and char_length(name) between 1 and 100),
  quantity numeric not null default 1,
  unit text not null default 'Stück',
  category text not null default 'Sonstiges',
  location text check (location in ('Kühlschrank','Gefrierfach','Vorratsschrank','Sonstiges')),
  expiry_date date check (expiry_date between date '0001-01-01' and date '9999-12-31'),
  date_type text check (date_type in ('MHD','Verbrauchsdatum','unbekannt')),
  barcode text check (private.valid_ean13(barcode)),
  status text not null default 'active',
  created_by uuid references public.profiles on delete set null,
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id,id),
  check (private.valid_item_unit(category,unit)),
  check (private.valid_quantity(quantity,unit)),
  check ((status = 'active' and quantity > 0) or (status = 'consumed' and quantity = 0)),
  check ((expiry_date is null) = (date_type is null))
);
create index on public.inventory_items (household_id,status,expiry_date,id);

create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null,
  inventory_item_id uuid not null,
  user_id uuid not null,
  quantity numeric not null check (quantity > 0 and quantity <= 9999 and scale(quantity) <= 3),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (household_id,inventory_item_id) references public.inventory_items(household_id,id) on delete cascade,
  foreign key (household_id,user_id) references public.household_members(household_id,user_id) on delete cascade,
  unique (inventory_item_id,user_id)
);
create index on public.reservations (household_id,user_id);

alter table public.inventory_items enable row level security;
alter table public.reservations enable row level security;
revoke all on public.inventory_items, public.reservations from public, anon, authenticated, service_role;
grant select on public.inventory_items, public.reservations to authenticated;
create policy members_read on public.inventory_items for select to authenticated
  using (household_id = (select private.my_household()));
create policy members_read on public.reservations for select to authenticated
  using (household_id = (select private.my_household()));

grant select, delete on public.inventory_items, public.reservations to zaeme_writer;
grant insert (household_id,name,quantity,unit,category,location,expiry_date,date_type,barcode,created_by),
  update (name,quantity,unit,category,location,expiry_date,date_type,barcode,status,version,updated_at)
  on public.inventory_items to zaeme_writer;
grant insert (household_id,inventory_item_id,user_id,quantity), update (quantity,updated_at)
  on public.reservations to zaeme_writer;
create policy rpc_write on public.inventory_items to zaeme_writer using (true) with check (true);
create policy rpc_write on public.reservations to zaeme_writer using (true) with check (true);

-- Eine Zeile pro aktiver Charge. Das API-Zeilenlimit greift erst nach der
-- Summierung. Der Aufrufer benötigt die Leserechte auf beiden RLS-Tabellen.
create view public.active_inventory with (security_invoker=true) as
select i.*, totals.reserved_quantity, totals.own_quantity,
  i.quantity-totals.reserved_quantity as free_quantity,
  i.quantity-totals.reserved_quantity+totals.own_quantity as consumable_quantity
from public.inventory_items i cross join lateral (
  select coalesce(sum(r.quantity),0) as reserved_quantity,
    coalesce(sum(r.quantity) filter (where r.user_id=(select auth.uid())),0) as own_quantity
  from public.reservations r where r.inventory_item_id=i.id and r.household_id=i.household_id
) totals where i.status='active';
revoke all on public.active_inventory from public,anon,authenticated,service_role;
grant select on public.active_inventory to authenticated;
