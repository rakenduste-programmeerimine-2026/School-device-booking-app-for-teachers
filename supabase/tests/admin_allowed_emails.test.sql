begin;
select plan(6);

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

select * from finish();
rollback;
