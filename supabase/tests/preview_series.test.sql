begin;
select plan(22);

-- Fixed ids so seed data cannot interfere.
insert into public.allowed_emails (email, role)
  values ('teacher@example.com', 'teacher'), ('removed@example.com', 'teacher');
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'teacher@example.com'),
  ('00000000-0000-0000-0000-00000000000f', 'removed@example.com');
delete from public.allowed_emails where email = 'removed@example.com';
insert into public.device_types (id, name, total_quantity, archived_at) overriding system value values
  (9701, 'Test preview laptops', 5, null),
  (9702, 'Test preview archived', 5, now());
-- Existing bookings: 3 of 5 on Mon 7 Sep 09-10, all 5 on Mon 14 Sep 09-10.
insert into public.booking_series (id, owner_id) overriding system value
  values (9701, '00000000-0000-0000-0000-00000000000a');
insert into public.bookings (series_id, device_type_id, quantity, starts_at, ends_at) values
  (9701, 9701, 3, '2026-09-07 09:00+03', '2026-09-07 10:00+03'),
  (9701, 9701, 5, '2026-09-14 09:00+03', '2026-09-14 10:00+03');

-- Function settings
select ok(
  (select prosecdef and 'search_path=""' = any(proconfig) from pg_proc
   where oid = 'public.preview_series(bigint,jsonb)'::regprocedure),
  'preview_series is SECURITY DEFINER with an empty search_path');
select ok(
  not has_function_privilege('anon', 'public.preview_series(bigint,jsonb)', 'execute'),
  'anon cannot execute preview_series');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';

-- One preview with four dates
create temporary table preview as
  select * from public.preview_series(9701, '[
    {"starts_at": "2026-09-07T09:00:00+03:00", "ends_at": "2026-09-07T10:00:00+03:00", "quantity": 2},
    {"starts_at": "2026-09-14T09:00:00+03:00", "ends_at": "2026-09-14T10:00:00+03:00", "quantity": 1},
    {"starts_at": "2026-09-07T10:00:00+03:00", "ends_at": "2026-09-07T11:00:00+03:00", "quantity": 5},
    {"starts_at": "2026-09-21T09:00:00+03:00", "ends_at": "2026-09-21T10:00:00+03:00", "quantity": 6}
  ]'::jsonb);

select is((select count(*)::int from preview), 4, 'one row per requested date');
select is(
  (select array_agg(date_position order by date_position) from preview), array[1, 2, 3, 4],
  'rows keep the input positions, so the UI can match them');
select ok(
  (select free_quantity = 2 and not has_conflict from preview where date_position = 1),
  '2 of 5 are free next to an existing booking of 3, and 2 fit');
select ok(
  (select free_quantity = 0 and has_conflict from preview where date_position = 2),
  'a fully booked date shows 0 free and a conflict');
select ok(
  (select free_quantity = 5 and not has_conflict from preview where date_position = 3),
  'a back-to-back slot right after a booking is fully free (half-open ranges)');
select ok(
  (select free_quantity = 5 and has_conflict from preview where date_position = 4),
  'asking for more than the total is a conflict even on an empty date');

select is(
  (select count(*)::int from public.preview_series(9701, '[]'::jsonb)), 0,
  'an empty list returns no rows');
select lives_ok(
  $$ select * from public.preview_series(9701, '[
    {"starts_at": "2026-09-28T09:00:00+03:00", "ends_at": "2026-09-28T10:00:00+03:00", "quantity": 1},
    {"starts_at": "2026-09-28T10:00:00+03:00", "ends_at": "2026-09-28T11:00:00+03:00", "quantity": 1}
  ]'::jsonb) $$,
  'two back-to-back dates in one list are not overlapping');

-- Refused input
select throws_ok(
  $$ select * from public.preview_series(9701, '[
    {"starts_at": "2026-09-28T09:00:00+03:00", "ends_at": "2026-09-28T10:00:00+03:00", "quantity": 1},
    {"starts_at": "2026-09-28T09:30:00+03:00", "ends_at": "2026-09-28T10:30:00+03:00", "quantity": 1}
  ]'::jsonb) $$,
  'P0001', 'overlapping_dates', 'two overlapping dates in one list are refused');
select throws_ok(
  $$ select * from public.preview_series(9702, '[
    {"starts_at": "2026-09-28T09:00:00+03:00", "ends_at": "2026-09-28T10:00:00+03:00", "quantity": 1}
  ]'::jsonb) $$,
  'P0001', 'device_type_archived', 'an archived device returns an error');
select throws_ok(
  $$ select * from public.preview_series(9999, '[]'::jsonb) $$,
  'P0001', 'device_type_not_found', 'an unknown device returns an error');
select throws_ok(
  $$ select * from public.preview_series(9701, '[
    {"starts_at": "2026-09-28T09:00:00+03:00", "ends_at": "2026-09-28T10:00:00+03:00", "quantity": 0}
  ]'::jsonb) $$,
  'P0001', 'invalid_quantity', 'a quantity below 1 is refused');
select throws_ok(
  $$ select * from public.preview_series(9701, '[
    {"starts_at": "2026-09-28T10:00:00+03:00", "ends_at": "2026-09-28T09:00:00+03:00", "quantity": 1}
  ]'::jsonb) $$,
  'P0001', 'invalid_range', 'a date ending before it starts is refused');
select throws_ok(
  $$ select * from public.preview_series(9701, '{"starts_at": "2026-09-28T09:00:00+03:00"}'::jsonb) $$,
  'P0001', 'invalid_dates', 'input that is not a list is refused');

-- Not signed in, or removed from the allow-list
set local request.jwt.claims = '{"role":"authenticated"}';
select throws_ok(
  $$ select * from public.preview_series(9701, '[]'::jsonb) $$,
  'P0001', 'not_authenticated', 'a request without a user is refused');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000f","role":"authenticated"}';
select throws_ok(
  $$ select * from public.preview_series(9701, '[]'::jsonb) $$,
  'P0001', 'access_revoked', 'a user removed from the allow-list is refused');

reset role;
set local role anon;
select throws_ok(
  $$ select * from public.preview_series(9701, '[]'::jsonb) $$,
  '42501', null, 'anon cannot call preview_series');
reset role;

-- Nothing was written by any of the previews above
select is((select count(*)::int from public.bookings where device_type_id = 9701), 2,
  'previews wrote no bookings');
select is((select count(*)::int from public.booking_series where owner_id = '00000000-0000-0000-0000-00000000000a'), 1,
  'previews wrote no series');
select is(
  (select count(*)::int from public.booking_changes where new_data ->> 'device_type_id' = '9701'), 2,
  'previews wrote no history');

select * from finish();
rollback;
