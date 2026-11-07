-- Lesson times that admins set. Picking a lesson only fills in a booking's start and end;
-- bookings keep storing plain timestamps, so free times and lessons share one code path.

-- `time` without a zone: a lesson is a Tallinn wall-clock time repeated every school day.
-- The app combines it with a date in Europe/Tallinn, which handles the DST change.
create table public.lesson_periods (
  id bigint generated always as identity primary key,
  lesson_number smallint not null unique check (lesson_number > 0),
  starts_at time not null,
  ends_at time not null,
  constraint lesson_periods_valid_range check (starts_at < ends_at)
);

revoke all on public.lesson_periods from anon, authenticated;
grant select, insert, update, delete on public.lesson_periods to authenticated;

alter table public.lesson_periods enable row level security;

create policy "Signed-in users read lesson periods"
  on public.lesson_periods for select to authenticated
  using (true);

create policy "Admins insert lesson periods"
  on public.lesson_periods for insert to authenticated
  with check ((select public.is_admin()));

create policy "Admins update lesson periods"
  on public.lesson_periods for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "Admins delete lesson periods"
  on public.lesson_periods for delete to authenticated
  using ((select public.is_admin()));
