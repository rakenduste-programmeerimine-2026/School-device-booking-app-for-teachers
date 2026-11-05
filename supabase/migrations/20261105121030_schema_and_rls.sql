-- Core booking schema and row-level security.
-- Writes to bookings and series go only through SECURITY DEFINER functions
-- added in later migrations, so clients get read access here and nothing more.

create type public.user_role as enum ('teacher', 'admin');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  full_name text,
  role public.user_role not null default 'teacher'
);

create table public.device_types (
  id bigint generated always as identity primary key,
  name text not null unique,
  total_quantity integer not null check (total_quantity > 0)
);

-- A single booking is a series of one, so single and bulk edits share one code path.
create table public.booking_series (
  id bigint generated always as identity primary key,
  owner_id uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

-- Ranges are half-open [starts_at, ends_at): a booking ending at 10:00 does not
-- conflict with one starting at 10:00. The check rules out empty or inverted ranges.
create table public.bookings (
  id bigint generated always as identity primary key,
  series_id bigint not null references public.booking_series (id) on delete cascade,
  device_type_id bigint not null references public.device_types (id),
  quantity integer not null check (quantity > 0),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  constraint bookings_range_half_open check (starts_at < ends_at)
);

-- SECURITY DEFINER so policies on profiles can call it without recursing into
-- the profiles policy itself.
create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- Table privileges are the first gate and RLS the second. Revoking writes on
-- bookings and series means a missing policy is not the only thing stopping clients.
revoke all on public.profiles, public.device_types, public.booking_series, public.bookings
  from anon, authenticated;
grant select on public.profiles, public.device_types, public.booking_series, public.bookings
  to authenticated;
grant insert, update, delete on public.device_types to authenticated;

alter table public.profiles enable row level security;
alter table public.device_types enable row level security;
alter table public.booking_series enable row level security;
alter table public.bookings enable row level security;

create policy "Users read own profile, admins read all"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));

create policy "Signed-in users read device types"
  on public.device_types for select to authenticated
  using (true);

create policy "Admins insert device types"
  on public.device_types for insert to authenticated
  with check ((select public.is_admin()));

create policy "Admins update device types"
  on public.device_types for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "Admins delete device types"
  on public.device_types for delete to authenticated
  using ((select public.is_admin()));

create policy "Signed-in users read booking series"
  on public.booking_series for select to authenticated
  using (true);

create policy "Signed-in users read bookings"
  on public.bookings for select to authenticated
  using (true);
