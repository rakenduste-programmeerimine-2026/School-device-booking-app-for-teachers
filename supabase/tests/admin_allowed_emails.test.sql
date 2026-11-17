begin;
select plan(10);

insert into public.allowed_emails (email, role)
  values ('boss@example.com', 'admin'), ('teacher@example.com', 'teacher');
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'boss@example.com'),
  ('00000000-0000-0000-0000-0000000000b1', 'teacher@example.com');

-- A teacher sees nothing and cannot add or remove entries
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}';
select is((select count(*)::int from public.allowed_emails), 0, 'teacher cannot read the allow-list');
select throws_ok(
  $$ insert into public.allowed_emails (email) values ('friend@example.com') $$,
  '42501', null, 'teacher cannot add an email');
select is_empty(
  $$ delete from public.allowed_emails where email = 'boss@example.com' returning 1 $$,
  'teacher cannot remove an email');

-- An admin adds and removes, and a removed teacher loses access
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select lives_ok(
  $$ insert into public.allowed_emails (email, role) values ('new@example.com', 'teacher') $$,
  'admin adds an email');
delete from public.allowed_emails where email = 'teacher@example.com';
reset role;
select ok(
  (select banned_until > now() + interval '99 years' from auth.users
   where id = '00000000-0000-0000-0000-0000000000b1'),
  'removing the email through the admin policy bans the user');
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select throws_ok(
  $$ delete from public.allowed_emails where email = 'boss@example.com' $$,
  'P0001', 'last_admin', 'the last admin cannot be removed');

-- Demoting: remove and re-add as teacher. The profile follows and admin rights go at once.
reset role;
insert into public.allowed_emails (email, role) values ('boss2@example.com', 'admin');
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000c1', 'boss2@example.com');
delete from public.allowed_emails where email = 'boss2@example.com';
insert into public.allowed_emails (email, role) values ('boss2@example.com', 'teacher');
select is((select role from public.profiles where email = 'boss2@example.com'), 'teacher',
  're-adding as teacher demotes the profile');
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}';
select is((select public.is_admin()), false, 'a demoted admin is no longer admin');

-- A removed admin cannot add their own email back while their token is still valid.
reset role;
delete from public.allowed_emails where email = 'boss2@example.com';
insert into public.allowed_emails (email, role) values ('boss2@example.com', 'admin');
delete from public.allowed_emails where email = 'boss2@example.com';
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}';
select throws_ok(
  $$ insert into public.allowed_emails (email, role) values ('boss2@example.com', 'admin') $$,
  '42501', null, 'a removed admin cannot re-add themselves');
select is((select public.is_admin()), false, 'a removed admin is not admin');

select * from finish();
rollback;
