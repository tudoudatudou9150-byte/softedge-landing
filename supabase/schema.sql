-- Nubohome Supabase schema
-- Run this in Supabase SQL Editor after creating the project.

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null default '',
  phone text not null default '',
  role text not null default 'customer' check (role in ('customer', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  full_name text not null,
  phone text not null,
  country text not null,
  region text not null default '',
  city text not null,
  postal_code text not null,
  address_line_1 text not null,
  address_line_2 text not null default '',
  is_default boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  user_id uuid not null references public.profiles(id) on delete restrict,
  address_id uuid references public.addresses(id) on delete set null,
  customer_email text not null,
  customer_name text not null,
  product_name text not null,
  style text not null check (style in ('L-Shaped', 'T-Shaped', 'Round')),
  pack_size integer not null check (pack_size in (1, 4, 8, 16, 20)),
  amount_usd numeric(10, 2) not null check (amount_usd >= 0),
  payment_status text not null default 'pending' check (payment_status in ('pending', 'paid', 'failed', 'refunded')),
  fulfillment_status text not null default 'processing' check (fulfillment_status in ('processing', 'shipped', 'delivered', 'cancelled', 'refunded')),
  paypal_order_id text,
  paypal_capture_id text,
  carrier text not null default '',
  tracking_number text not null default '',
  admin_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  label text not null,
  detail text not null default '',
  event_date date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists idx_addresses_user_id on public.addresses(user_id);
create index if not exists idx_orders_user_id_created_at on public.orders(user_id, created_at desc);
create index if not exists idx_orders_status_created_at on public.orders(fulfillment_status, created_at desc);
create index if not exists idx_order_events_order_id_created_at on public.order_events(order_id, created_at);

alter table public.profiles enable row level security;
alter table public.addresses enable row level security;
alter table public.orders enable row level security;
alter table public.order_events enable row level security;

drop policy if exists "Customers can read own profile" on public.profiles;
drop policy if exists "Customers can update own profile" on public.profiles;
drop policy if exists "Customers can insert own profile" on public.profiles;
drop policy if exists "Customers can manage own addresses" on public.addresses;
drop policy if exists "Customers can read own orders" on public.orders;
drop policy if exists "Admins can update orders" on public.orders;
drop policy if exists "Customers can read own order events" on public.order_events;
drop policy if exists "Admins can manage order events" on public.order_events;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

create policy "Customers can read own profile"
  on public.profiles for select
  using ((auth.uid() is not null and auth.uid() = id) or public.is_admin());

create policy "Customers can update own profile"
  on public.profiles for update
  using (auth.uid() is not null and auth.uid() = id)
  with check (auth.uid() is not null and auth.uid() = id and role = 'customer');

create policy "Customers can insert own profile"
  on public.profiles for insert
  with check (auth.uid() is not null and auth.uid() = id and role = 'customer');

create policy "Customers can manage own addresses"
  on public.addresses for all
  using ((auth.uid() is not null and auth.uid() = user_id) or public.is_admin())
  with check ((auth.uid() is not null and auth.uid() = user_id) or public.is_admin());

create policy "Customers can read own orders"
  on public.orders for select
  using ((auth.uid() is not null and auth.uid() = user_id) or public.is_admin());

create policy "Admins can update orders"
  on public.orders for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "Customers can read own order events"
  on public.order_events for select
  using (
    public.is_admin()
    or exists (
      select 1
      from public.orders
      where orders.id = order_events.order_id
        and auth.uid() is not null
        and orders.user_id = auth.uid()
    )
  );

create policy "Admins can manage order events"
  on public.order_events for all
  using (public.is_admin())
  with check (public.is_admin());

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'full_name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
