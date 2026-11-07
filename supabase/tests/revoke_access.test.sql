begin;
select plan(12);

-- Teacher with a mixed-case email, an open session with a refresh token, and a booking.
insert into public.allowed_emails (email, role) values ('teacher@example.com', 'teacher');
insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000a', 'Teacher@Example.com');
insert into auth.sessions (id, user_id)
  values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000000a');
insert into auth.refresh_tokens (token, user_id, session_id)
  values ('test-refresh-token', '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a1');
insert into public.device_types (id, name, total_quantity) overriding system value
  values (9101, 'Test revoke device', 5);
insert into public.booking_series (id, owner_id) overriding system value
  values (9101, '00000000-0000-0000-0000-00000000000a');
insert into public.bookings (series_id, device_type_id, quantity, starts_at, ends_at)
  values (9101, 9101, 1, '2026-09-01 09:00+03', '2026-09-01 10:00+03');

-- A role change keeps the email, so it must not lock the user out
update public.allowed_emails set role = 'admin' where email = 'teacher@example.com';
select is(
  (select banned_until from auth.users where id = '00000000-0000-0000-0000-00000000000a'), null,
  'role change does not ban the user');
select is(
  (select count(*)::int from auth.sessions where user_id = '00000000-0000-0000-0000-00000000000a'), 1,
  'role change keeps the user signed in');

-- Removal
delete from public.allowed_emails where email = 'teacher@example.com';
select ok(
  (select banned_until > now() + interval '99 years' from auth.users
   where id = '00000000-0000-0000-0000-00000000000a'),
  'removing the email bans the user, matched case-insensitively');
select is(
  (select count(*)::int from auth.sessions where user_id = '00000000-0000-0000-0000-00000000000a'), 0,
  'removing the email ends the user''s sessions');
select is(
  (select count(*)::int from auth.refresh_tokens where token = 'test-refresh-token'), 0,
  'the session''s refresh token is gone, so access cannot be renewed');
select is(
  (select count(*)::int from public.profiles where id = '00000000-0000-0000-0000-00000000000a'), 1,
  'profile is kept');
select is(
  (select count(*)::int from public.bookings where series_id = 9101), 1,
  'bookings are kept');
select is(
  (select count(*)::int from public.booking_changes where series_id = 9101), 1,
  'booking history is kept');

-- Re-adding
insert into public.allowed_emails (email, role) values ('teacher@example.com', 'teacher');
select is(
  (select banned_until from auth.users where id = '00000000-0000-0000-0000-00000000000a'), null,
  're-adding the email lifts the ban');

-- Renaming moves access from the old address to the new one
-- new@example.com had an account earlier and was removed, so it starts banned.
insert into public.allowed_emails (email) values ('new@example.com');
insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000c', 'new@example.com');
delete from public.allowed_emails where email = 'new@example.com';
update public.allowed_emails set email = 'new@example.com' where email = 'teacher@example.com';
select ok(
  (select banned_until is not null from auth.users where id = '00000000-0000-0000-0000-00000000000a'),
  'renaming the email bans the old address');
select is(
  (select banned_until from auth.users where id = '00000000-0000-0000-0000-00000000000c'), null,
  'renaming the email unbans the new address');

-- Clients cannot run the function directly
set local role authenticated;
select throws_ok(
  $$ select public.sync_access_with_allow_list() $$,
  '42501', null, 'clients cannot call the trigger function');

reset role;
select * from finish();
rollback;
