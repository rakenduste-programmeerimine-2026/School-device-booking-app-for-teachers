-- School year dates and non-teaching periods are data, because admins change them every year.

create table public.school_years (
  id bigint generated always as identity primary key,
  starts_on date not null,
  ends_on date not null,
  constraint school_years_valid_range check (starts_on < ends_on),
  -- Date generation must find exactly one school year for any date.
  constraint school_years_no_overlap
    exclude using gist (daterange(starts_on, ends_on, '[]') with &&)
);

create type public.non_teaching_kind as enum ('break', 'public_holiday', 'day_off');

-- Days are inclusive, matching how breaks are announced (26.10–01.11 includes both days).
-- A one-day holiday has starts_on = ends_on.
create table public.non_teaching_periods (
  id bigint generated always as identity primary key,
  school_year_id bigint not null references public.school_years (id) on delete cascade,
  kind public.non_teaching_kind not null,
  name text not null,
  starts_on date not null,
  ends_on date not null,
  constraint non_teaching_periods_valid_range check (starts_on <= ends_on)
);

revoke all on public.school_years, public.non_teaching_periods from anon, authenticated;
grant select, insert, update, delete on public.school_years, public.non_teaching_periods
  to authenticated;

alter table public.school_years enable row level security;
alter table public.non_teaching_periods enable row level security;

create policy "Signed-in users read school years"
  on public.school_years for select to authenticated
  using (true);

create policy "Admins insert school years"
  on public.school_years for insert to authenticated
  with check ((select public.is_admin()));

create policy "Admins update school years"
  on public.school_years for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "Admins delete school years"
  on public.school_years for delete to authenticated
  using ((select public.is_admin()));

create policy "Signed-in users read non-teaching periods"
  on public.non_teaching_periods for select to authenticated
  using (true);

create policy "Admins insert non-teaching periods"
  on public.non_teaching_periods for insert to authenticated
  with check ((select public.is_admin()));

create policy "Admins update non-teaching periods"
  on public.non_teaching_periods for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "Admins delete non-teaching periods"
  on public.non_teaching_periods for delete to authenticated
  using ((select public.is_admin()));
