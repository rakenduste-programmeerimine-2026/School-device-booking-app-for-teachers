begin;
select plan(18);

-- Fixed ids so seed data cannot interfere.
insert into public.allowed_emails (email, role) values
  ('teacher-a@example.com', 'teacher'), ('teacher-b@example.com', 'teacher'), ('removed@example.com', 'teacher');
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'teacher-a@example.com'),
  ('00000000-0000-0000-0000-0000000000b1', 'teacher-b@example.com'),
  ('00000000-0000-0000-0000-00000000000f', 'removed@example.com');
delete from public.allowed_emails where email = 'removed@example.com';
insert into public.device_types (id, name, total_quantity, archived_at) overriding system value values
  (9801, 'Test series laptops', 5, null),
  (9802, 'Test series archived', 5, now());

-- Returns the error message and detail of a refused commit, so the conflicts can be checked.
create function pg_temp.commit_error(p_device bigint, p_dates jsonb) returns text
language plpgsql as $$
declare
  message text;
  detail text;
begin
  perform public.commit_series(p_device, p_dates);
  return 'committed';
exception when others then
  get stacked diagnostics message = message_text, detail = pg_exception_detail;
  return message || ' ' || coalesce(detail, '');
end;
$$;

-- Function settings
select ok(
  (select prosecdef and 'search_path=""' = any(proconfig) from pg_proc
   where oid = 'public.commit_series(bigint,jsonb)'::regprocedure),
  'commit_series is SECURITY DEFINER with an empty search_path');
select ok(
  not has_function_privilege('anon', 'public.commit_series(bigint,jsonb)', 'execute'),
  'anon cannot execute commit_series');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';

-- A successful commit: one series, a booking per date
create temporary table committed as
  select public.commit_series(9801, '[
    {"starts_at": "2026-09-07T09:00:00+03:00", "ends_at": "2026-09-07T10:00:00+03:00", "quantity": 2},
    {"starts_at": "2026-09-14T09:00:00+03:00", "ends_at": "2026-09-14T10:00:00+03:00", "quantity": 2},
    {"starts_at": "2026-09-21T09:00:00+03:00", "ends_at": "2026-09-21T10:00:00+03:00", "quantity": 2}
  ]'::jsonb) as series_id;

select is(
  (select count(*)::int from public.bookings where series_id = (select series_id from committed)), 3,
  'a commit writes a booking for every date, all in one series');
select is(
  (select owner_id from public.booking_series where id = (select series_id from committed)),
  '00000000-0000-0000-0000-0000000000a1'::uuid,
  'the series belongs to the teacher who committed it');

-- Availability changes between preview and commit
select ok(
  not (select bool_or(has_conflict) from public.preview_series(9801, '[
    {"starts_at": "2026-10-05T09:00:00+03:00", "ends_at": "2026-10-05T10:00:00+03:00", "quantity": 4},
    {"starts_at": "2026-09-28T09:00:00+03:00", "ends_at": "2026-09-28T10:00:00+03:00", "quantity": 4}
  ]'::jsonb)),
  'the preview shows no conflicts');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}';
select public.create_booking(9801, 2, '2026-09-28 09:00+03', '2026-09-28 10:00+03') is not null as b_booked \g /dev/null
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';

select is(
  pg_temp.commit_error(9801, '[
    {"starts_at": "2026-10-05T09:00:00+03:00", "ends_at": "2026-10-05T10:00:00+03:00", "quantity": 4},
    {"starts_at": "2026-09-28T09:00:00+03:00", "ends_at": "2026-09-28T10:00:00+03:00", "quantity": 4}
  ]'::jsonb),
  'insufficient_capacity [{"date_position": 2, "free_quantity": 3}]',
  'a date that filled up after the preview is refused, and the detail names it with its free quantity');
select is(
  (select count(*)::int from public.bookings
   where device_type_id = 9801 and starts_at = '2026-10-05 09:00+03'), 0,
  'the refused commit wrote none of its dates, not even the one that still fit');
select is(
  (select count(*)::int from public.booking_series where owner_id = '00000000-0000-0000-0000-0000000000a1'), 1,
  'the refused commit wrote no series');

-- Refused input and devices
select throws_ok(
  $$ select public.commit_series(9802, '[
    {"starts_at": "2026-10-12T09:00:00+03:00", "ends_at": "2026-10-12T10:00:00+03:00", "quantity": 1}
  ]'::jsonb) $$,
  'P0001', 'device_type_archived', 'committing for an archived device returns an error');
select throws_ok(
  $$ select public.commit_series(9999, '[]'::jsonb) $$,
  'P0001', 'device_type_not_found', 'an unknown device returns an error');
select throws_ok(
  $$ select public.commit_series(9801, '[]'::jsonb) $$,
  'P0001', 'invalid_dates', 'an empty series is refused');
select throws_ok(
  $$ select public.commit_series(9801, '[
    {"starts_at": "2026-10-12T09:00:00+03:00", "ends_at": "2026-10-12T10:00:00+03:00", "quantity": 1},
    {"starts_at": "2026-10-12T09:30:00+03:00", "ends_at": "2026-10-12T10:30:00+03:00", "quantity": 1}
  ]'::jsonb) $$,
  'P0001', 'overlapping_dates', 'overlapping dates are refused, with the same rule as the preview');
select throws_ok(
  $$ select public.commit_series(9801, '[
    {"starts_at": "2026-10-12T09:00:00+03:00", "ends_at": "2026-10-12T10:00:00+03:00", "quantity": "abc"}
  ]'::jsonb) $$,
  'P0001', 'invalid_quantity', 'a bad value gives a coded error, as in the preview');

-- Not signed in, or removed from the allow-list
set local request.jwt.claims = '{"role":"authenticated"}';
select throws_ok(
  $$ select public.commit_series(9801, '[]'::jsonb) $$,
  'P0001', 'not_authenticated', 'a request without a user is refused');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000f","role":"authenticated"}';
select throws_ok(
  $$ select public.commit_series(9801, '[]'::jsonb) $$,
  'P0001', 'access_revoked', 'a user removed from the allow-list is refused');

reset role;
set local role anon;
select throws_ok(
  $$ select public.commit_series(9801, '[]'::jsonb) $$,
  '42501', null, 'anon cannot call commit_series');
reset role;

-- History, read as the owner because only admins may read it through the API
select is(
  (select count(*)::int from public.booking_changes
   where action = 'created' and series_id = (select series_id from committed)
     and changed_by = '00000000-0000-0000-0000-0000000000a1'), 3,
  'every committed booking is in the history, recorded as teacher A');
select is(
  (select count(*)::int from public.booking_changes
   where new_data ->> 'starts_at' like '2026-10-05%'), 0,
  'the refused commit left no history');

select * from finish();
rollback;
