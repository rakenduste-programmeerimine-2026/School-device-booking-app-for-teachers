begin;
select plan(17);

-- Fixed ids so the checks below do not depend on seed data.
insert into public.allowed_emails (email, role)
  values ('teacher@example.com', 'teacher'), ('boss@example.com', 'admin');
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'teacher@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'boss@example.com');
insert into public.device_types (id, name, total_quantity) overriding system value
  values (9001, 'Test history device', 10);
insert into public.booking_series (id, owner_id) overriding system value
  values (9001, '00000000-0000-0000-0000-00000000000a');

-- Booking writes run as postgres here, standing in for the SECURITY DEFINER functions
-- from #8. The claims say who is signed in, which is what auth.uid() reads.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';
insert into public.bookings (id, series_id, device_type_id, quantity, starts_at, ends_at) overriding system value
  values (9001, 9001, 9001, 2, '2026-09-01 09:00+03', '2026-09-01 10:00+03');
update public.bookings set quantity = 3 where id = 9001;
-- An update that changes nothing must not add history.
update public.bookings set quantity = quantity where id = 9001;
-- A rolled-back write must leave no history.
savepoint before_rolled_back_write;
insert into public.bookings (id, series_id, device_type_id, quantity, starts_at, ends_at) overriding system value
  values (9002, 9001, 9001, 1, '2026-09-02 09:00+03', '2026-09-02 10:00+03');
rollback to savepoint before_rolled_back_write;
-- Deleting the series cascades to the booking; the history must record and keep it.
delete from public.booking_series where id = 9001;

-- Recording
select is(
  (select changed_by from public.booking_changes where booking_id = 9001 and action = 'created'),
  '00000000-0000-0000-0000-00000000000a'::uuid,
  'creating a booking records who did it');
select ok(
  (select old_data is null and new_data ->> 'quantity' = '2'
   from public.booking_changes where booking_id = 9001 and action = 'created'),
  'created row has only the new data');
select ok(
  (select old_data ->> 'quantity' = '2' and new_data ->> 'quantity' = '3'
   from public.booking_changes where booking_id = 9001 and action = 'updated' order by id limit 1),
  'updated row has the data before and after');
select ok(
  (select old_data ->> 'quantity' = '3' and new_data is null and series_id = 9001
   from public.booking_changes where booking_id = 9001 and action = 'deleted'),
  'cascade delete from the series is recorded');
select is(
  (select count(*)::int from public.booking_changes where booking_id = 9001), 3,
  'history survives deleting the booking and its series');
select is(
  (select count(*)::int from public.booking_changes where booking_id = 9001 and action = 'updated'), 1,
  'an update that changes nothing adds no history');
select is(
  (select count(*)::int from public.booking_changes where booking_id = 9002), 0,
  'a rolled-back write leaves no history');
select throws_ok(
  $$ insert into public.booking_changes (booking_id, series_id, action, old_data, new_data)
     values (9001, 9001, 'created', '{}', '{}') $$,
  '23514', null, 'data that does not match the action is rejected');

-- Teacher: cannot read or write
set local role authenticated;
select is((select count(*)::int from public.booking_changes), 0, 'teacher cannot read the history');
select throws_ok(
  $$ insert into public.booking_changes (booking_id, series_id, action, new_data) values (1, 1, 'created', '{}') $$,
  '42501', null, 'teacher cannot add history');
select throws_ok(
  $$ update public.booking_changes set action = 'updated' $$,
  '42501', null, 'teacher cannot change history');
select throws_ok(
  $$ delete from public.booking_changes $$,
  '42501', null, 'teacher cannot delete history');

-- Admin: can read, cannot write
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}';
select is(
  (select count(*)::int from public.booking_changes where booking_id = 9001), 3,
  'admin reads the history');
select throws_ok(
  $$ insert into public.booking_changes (booking_id, series_id, action, new_data) values (1, 1, 'created', '{}') $$,
  '42501', null, 'admin cannot add history directly');
select throws_ok(
  $$ update public.booking_changes set action = 'updated' $$,
  '42501', null, 'admin cannot change history');
select throws_ok(
  $$ delete from public.booking_changes $$,
  '42501', null, 'admin cannot delete history');

-- Signed out
reset role;
set local role anon;
select throws_ok(
  $$ select count(*) from public.booking_changes $$,
  '42501', null, 'signed-out user cannot read the history');

reset role;
select * from finish();
rollback;
