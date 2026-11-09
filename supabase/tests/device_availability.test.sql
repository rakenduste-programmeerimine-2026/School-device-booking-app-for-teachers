begin;
select plan(4);

-- Peak use, half-open ranges and the 0 floor are covered by create_booking.test.sql through
-- available_quantity. This test covers what device_availability adds: Tallinn wall-clock
-- times, hiding archived devices, and access.
insert into public.allowed_emails (email, role) values ('teacher@example.com', 'teacher');
insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000a', 'teacher@example.com');
insert into public.device_types (name, total_quantity) values ('Test projector', 10), ('Test old camera', 5);
update public.device_types set archived_at = now() where name = 'Test old camera';
insert into public.booking_series (owner_id) values ('00000000-0000-0000-0000-00000000000a');

-- Booking writes run as postgres here, standing in for create_booking. One booking in
-- September (UTC+3) and one in December, after the DST change (UTC+2).
insert into public.bookings (series_id, device_type_id, quantity, starts_at, ends_at)
  select (select max(id) from public.booking_series), d.id, v.quantity, v.starts_at, v.ends_at
  from public.device_types d,
    (values (4, '2026-09-01 09:00+03'::timestamptz, '2026-09-01 10:00+03'::timestamptz),
            (7, '2026-12-01 09:00+02', '2026-12-01 10:00+02')) v (quantity, starts_at, ends_at)
  where d.name = 'Test projector';

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';

select is(
  (select free_quantity from public.device_availability('2026-09-01', '09:00', '10:00')
   where name = 'Test projector'), 6,
  'September times are read as Tallinn summer time');

select is(
  (select free_quantity from public.device_availability('2026-12-01', '09:00', '10:00')
   where name = 'Test projector'), 3,
  'December times are read as Tallinn winter time, after the DST change');

select is(
  (select count(*)::int from public.device_availability('2026-09-01', '09:00', '10:00')
   where name = 'Test old camera'), 0,
  'archived devices are not offered');

reset role;
set local role anon;
select throws_ok(
  $$ select * from public.device_availability('2026-09-01', '09:00', '10:00') $$,
  '42501', null, 'anon cannot read availability');

select * from finish();
rollback;
