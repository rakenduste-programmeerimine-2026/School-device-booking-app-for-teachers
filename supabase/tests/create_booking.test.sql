begin;
select plan(25);

-- Fixed ids so seed data cannot interfere.
insert into public.allowed_emails (email, role)
  values ('teacher@example.com', 'teacher'), ('removed@example.com', 'teacher');
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'teacher@example.com'),
  ('00000000-0000-0000-0000-00000000000f', 'removed@example.com');
delete from public.allowed_emails where email = 'removed@example.com';
insert into public.device_types (id, name, total_quantity, archived_at) overriding system value values
  (9201, 'Test laptops', 5, null),
  (9202, 'Test archived', 5, now());

-- Function settings
select ok(
  (select prosecdef from pg_proc where oid = 'public.create_booking(bigint,integer,timestamptz,timestamptz)'::regprocedure),
  'create_booking is SECURITY DEFINER');
select ok(
  (select 'search_path=""' = any(proconfig) from pg_proc
   where oid = 'public.create_booking(bigint,integer,timestamptz,timestamptz)'::regprocedure),
  'create_booking has an empty search_path');
select ok(
  not has_function_privilege('anon', 'public.create_booking(bigint,integer,timestamptz,timestamptz)', 'execute')
  and not has_function_privilege('anon', 'public.available_quantity(bigint,timestamptz,timestamptz)', 'execute'),
  'anon cannot execute the booking functions');

-- Teacher books
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';

select lives_ok(
  $$ select public.create_booking(9201, 3, '2026-09-01 09:00+03', '2026-09-01 10:00+03') $$,
  'teacher books 3 of 5 for 09:00-10:00');
select lives_ok(
  $$ select public.create_booking(9201, 3, '2026-09-01 10:00+03', '2026-09-01 11:00+03') $$,
  'back-to-back lesson 10:00-11:00 does not conflict (half-open ranges)');
select lives_ok(
  $$ select public.create_booking(9201, 2, '2026-09-01 09:00+03', '2026-09-01 11:00+03') $$,
  'peak, not sum: 2 more over 09:00-11:00 fit because at most 3 are in use at once');
select throws_ok(
  $$ select public.create_booking(9201, 1, '2026-09-01 09:30+03', '2026-09-01 10:30+03') $$,
  'P0001', 'insufficient_capacity', 'one more than the peak allows is refused');
select is(
  (select count(*)::int from public.bookings where device_type_id = 9201), 3,
  'the refused booking wrote no booking row');
select is(
  (select count(*)::int from public.booking_series where owner_id = '00000000-0000-0000-0000-00000000000a'), 3,
  'the refused booking wrote no series row, and each booking is its own series');

select is(public.available_quantity(9201, '2026-09-01 09:00+03', '2026-09-01 11:00+03'), 0,
  'availability is 0 while the device is fully booked');
select is(public.available_quantity(9201, '2026-09-01 11:00+03', '2026-09-01 12:00+03'), 5,
  'availability is the full total right after the last booking ends');

select throws_ok(
  $$ select public.create_booking(9202, 1, '2026-09-01 09:00+03', '2026-09-01 10:00+03') $$,
  'P0001', 'device_type_archived', 'an archived device cannot be booked');
select throws_ok(
  $$ select public.create_booking(9999, 1, '2026-09-01 09:00+03', '2026-09-01 10:00+03') $$,
  'P0001', 'device_type_not_found', 'an unknown device cannot be booked');
select throws_ok(
  $$ select public.create_booking(9201, 0, '2026-09-02 09:00+03', '2026-09-02 10:00+03') $$,
  'P0001', 'invalid_quantity', 'quantity must be above 0');
select throws_ok(
  $$ select public.create_booking(9201, 1, '2026-09-02 10:00+03', '2026-09-02 10:00+03') $$,
  'P0001', 'invalid_range', 'the end must be after the start');

-- Not signed in, or removed from the allow-list
set local request.jwt.claims = '{"role":"authenticated"}';
select throws_ok(
  $$ select public.create_booking(9201, 1, '2026-09-02 09:00+03', '2026-09-02 10:00+03') $$,
  'P0001', 'not_authenticated', 'a request without a user is refused');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000f","role":"authenticated"}';
select throws_ok(
  $$ select public.create_booking(9201, 1, '2026-09-02 09:00+03', '2026-09-02 10:00+03') $$,
  'P0001', 'access_revoked', 'a user removed from the allow-list cannot book with a still-valid token');

reset role;
set local role anon;
select throws_ok(
  $$ select public.create_booking(9201, 1, '2026-09-02 09:00+03', '2026-09-02 10:00+03') $$,
  '42501', null, 'anon cannot call create_booking');
reset role;

-- History, read as the owner because only admins may read it through the API
select is(
  (select count(*)::int from public.booking_changes
   where action = 'created' and new_data ->> 'device_type_id' = '9201'), 3,
  'every created booking is in the history');
select is(
  (select count(distinct changed_by)::int from public.booking_changes
   where new_data ->> 'device_type_id' = '9201' and changed_by = '00000000-0000-0000-0000-00000000000a'), 1,
  'history records the teacher as the one who booked');
select is(
  (select count(*)::int from public.booking_changes where new_data ->> 'device_type_id' = '9201'), 3,
  'refused bookings left no history');

-- Lowering the total below what is booked (decided in #37): never negative
update public.device_types set total_quantity = 1 where id = 9201;
select is(public.available_quantity(9201, '2026-09-01 09:00+03', '2026-09-01 11:00+03'), 0,
  'availability is 0, not negative, when the total drops below the booked peak');

-- Peak helper directly: overlapping the range but not each other does not add up
select is(public.peak_usage(9201, '2026-09-01 08:00+03', '2026-09-01 12:00+03'), 5,
  'peak over the whole morning is 5 (3 + 2 at 09:00, 3 + 2 at 10:00), not the sum 8');
select is(public.peak_usage(9201, '2026-09-01 11:00+03', '2026-09-01 12:00+03'), 0,
  'nothing is in use after the last booking ends at 11:00');
select is(public.peak_usage(9201, '2026-09-01 08:00+03', '2026-09-01 09:00+03'), 0,
  'nothing is in use before the first booking starts at 09:00');

select * from finish();
rollback;
