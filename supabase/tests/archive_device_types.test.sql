begin;
select plan(13);

-- Fixture names are unique to this test, so seeded devices cannot clash with them.
insert into public.allowed_emails (email, role)
  values ('teacher@example.com', 'teacher'), ('boss@example.com', 'admin');
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'teacher@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'boss@example.com');
insert into public.device_types (name, total_quantity) values ('Test laptop', 30), ('Test camera', 5);
insert into public.booking_series (owner_id) values ('00000000-0000-0000-0000-00000000000a');
-- Booking writes run as postgres here, standing in for the SECURITY DEFINER functions from #8.
insert into public.bookings (series_id, device_type_id, quantity, starts_at, ends_at)
  select (select max(id) from public.booking_series), id, 2, '2026-09-01 09:00+03', '2026-09-01 10:00+03'
  from public.device_types where name = 'Test camera';

-- Admin archives, teacher cannot
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}';
select lives_ok(
  $$ update public.device_types set archived_at = now() where name = 'Test camera' $$,
  'admin archives a device');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';
update public.device_types set archived_at = now() where name = 'Test laptop';
select is(
  (select count(*)::int from public.device_types where name = 'Test camera' and archived_at is not null), 1,
  'teacher still sees the archived device, for its old bookings');

reset role;
select is(
  (select archived_at from public.device_types where name = 'Test laptop'), null,
  'teacher cannot archive a device');

-- Archived devices take no new bookings
select throws_ok(
  $$ insert into public.bookings (series_id, device_type_id, quantity, starts_at, ends_at)
     select (select max(id) from public.booking_series), id, 1, '2026-09-02 09:00+03', '2026-09-02 10:00+03'
     from public.device_types where name = 'Test camera' $$,
  'P0001', 'device_type_archived', 'new booking for an archived device is rejected');
select lives_ok(
  $$ insert into public.bookings (series_id, device_type_id, quantity, starts_at, ends_at)
     select (select max(id) from public.booking_series), id, 5, '2026-09-02 09:00+03', '2026-09-02 10:00+03'
     from public.device_types where name = 'Test laptop' $$,
  'new booking for an active device is allowed');
select throws_ok(
  $$ update public.bookings set device_type_id = (select id from public.device_types where name = 'Test camera')
     where device_type_id = (select id from public.device_types where name = 'Test laptop') $$,
  'P0001', 'device_type_archived', 'moving a booking to an archived device is rejected');

-- Old bookings stay
select lives_ok(
  $$ update public.bookings set ends_at = '2026-09-01 10:30+03'
     where device_type_id = (select id from public.device_types where name = 'Test camera') $$,
  'an existing booking of an archived device can still be corrected');
select is(
  (select count(*)::int from public.bookings
   where device_type_id = (select id from public.device_types where name = 'Test camera')), 1,
  'old booking of the archived device is kept');
select throws_ok(
  $$ delete from public.device_types where name = 'Test camera' $$,
  '23503', null, 'a device with bookings cannot be deleted');

-- Restore
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}';
select lives_ok(
  $$ update public.device_types set archived_at = null where name = 'Test camera' $$,
  'admin restores an archived device');
reset role;
select lives_ok(
  $$ insert into public.bookings (series_id, device_type_id, quantity, starts_at, ends_at)
     select (select max(id) from public.booking_series), id, 1, '2026-09-03 09:00+03', '2026-09-03 10:00+03'
     from public.device_types where name = 'Test camera' $$,
  'restored device can be booked again');

-- Decision: lowering the total below what is booked is allowed, and bookings stay
select lives_ok(
  $$ update public.device_types set total_quantity = 1 where name = 'Test laptop' $$,
  'total can drop below the booked quantity');
select is(
  (select quantity from public.bookings
   where device_type_id = (select id from public.device_types where name = 'Test laptop')), 5,
  'existing booking keeps its quantity after the total drops');

select * from finish();
rollback;
