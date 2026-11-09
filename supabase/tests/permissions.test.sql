begin;
select plan(8);

insert into public.allowed_emails (email, role)
  values ('teacher-a@example.com', 'teacher'), ('teacher-b@example.com', 'teacher');
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'teacher-a@example.com'),
  ('00000000-0000-0000-0000-0000000000b1', 'teacher-b@example.com');
insert into public.device_types (id, name, total_quantity) overriding system value
  values (9501, 'Test permissions device', 10);

-- Teacher B books through the function, as the app does.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}';
select lives_ok(
  $$ select public.create_booking(9501, 2, '2026-09-01 09:00+03', '2026-09-01 10:00+03') $$,
  'teacher B books through the function');

-- Teacher A cannot change or delete teacher B's booking (decision 6).
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select is((select count(*)::int from public.bookings where device_type_id = 9501), 1,
  'teacher A can see teacher B''s booking');
select throws_ok(
  $$ update public.bookings set quantity = 1 where device_type_id = 9501 $$,
  '42501', null, 'teacher A cannot change teacher B''s booking');
select throws_ok(
  $$ delete from public.bookings where device_type_id = 9501 $$,
  '42501', null, 'teacher A cannot delete teacher B''s booking');
select throws_ok(
  $$ delete from public.booking_series where owner_id = '00000000-0000-0000-0000-0000000000b1' $$,
  '42501', null, 'teacher A cannot delete teacher B''s series');

-- Teachers do not write bookings directly at all, not even their own: writes go through functions.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}';
select throws_ok(
  $$ update public.bookings set quantity = 1 where device_type_id = 9501 $$,
  '42501', null, 'teacher B cannot change even their own booking directly');
reset role;

-- Function privileges across the whole public schema, so a new function that forgets its
-- revoke is caught. Extension functions (pgTAP itself) are left out.
select is(
  (select array_agg(p.proname order by p.proname) from pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
     and has_function_privilege('anon', p.oid, 'execute')),
  null,
  'anon can execute no function in public');
-- When a new client-callable function is added, add it here on purpose.
select is(
  (select array_agg(p.proname::text order by p.proname) from pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
     and has_function_privilege('authenticated', p.oid, 'execute')),
  array['available_quantity', 'create_booking', 'device_availability', 'is_admin', 'peak_usage'],
  'signed-in users can execute only the intended functions');

select * from finish();
rollback;
