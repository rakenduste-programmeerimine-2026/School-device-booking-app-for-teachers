begin;
select plan(7);

insert into public.allowed_emails (email, role) values ('teacher@example.com', 'teacher');
insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000a', 'teacher@example.com');
insert into public.device_types (name, total_quantity) values ('Test projector', 10), ('Test old camera', 5);
update public.device_types set archived_at = now() where name = 'Test old camera';
insert into public.booking_series (owner_id) values ('00000000-0000-0000-0000-00000000000a');

-- Booking writes run as postgres here, standing in for the SECURITY DEFINER functions from #8.
-- Two back-to-back bookings (09-10 and 10-11) and one in December, after the DST change.
insert into public.bookings (series_id, device_type_id, quantity, starts_at, ends_at)
  select (select max(id) from public.booking_series), d.id, v.quantity, v.starts_at, v.ends_at
  from public.device_types d,
    (values (3, '2026-09-01 09:00+03'::timestamptz, '2026-09-01 10:00+03'::timestamptz),
            (4, '2026-09-01 10:00+03', '2026-09-01 11:00+03'),
            (7, '2026-12-01 09:00+02', '2026-12-01 10:00+02')) v (quantity, starts_at, ends_at)
  where d.name = 'Test projector';

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';

select is(
  (select free_quantity from public.device_availability('2026-09-01', '09:00', '11:00') where name = 'Test projector'), 6,
  'peak use counts bookings that overlap the range but not each other once, not summed');

select is(
  (select free_quantity from public.device_availability('2026-09-01', '10:00', '11:00')
   where name = 'Test projector'), 6,
  'half-open: a booking ending at 10:00 is not in use from 10:00');

select is(
  (select free_quantity from public.device_availability('2026-09-01', '08:00', '09:00')
   where name = 'Test projector'), 10,
  'half-open: a booking starting at 09:00 is not in use before 09:00');

select is(
  (select free_quantity from public.device_availability('2026-12-01', '09:00', '10:00')
   where name = 'Test projector'), 3,
  'times are Tallinn wall-clock after the DST change too');

select is(
  (select count(*)::int from public.device_availability('2026-09-01', '09:00', '11:00') where name = 'Test old camera'), 0,
  'archived devices are not offered');

reset role;
update public.device_types set total_quantity = 2 where name = 'Test projector';
set local role authenticated;
select is(
  (select free_quantity from public.device_availability('2026-09-01', '09:00', '11:00') where name = 'Test projector'), 0,
  'free quantity is 0, not negative, when the total drops under what is booked');

reset role;
set local role anon;
select throws_ok(
  $$ select * from public.device_availability('2026-09-01', '09:00', '11:00') $$,
  '42501', null, 'anon cannot read availability');

select * from finish();
rollback;
