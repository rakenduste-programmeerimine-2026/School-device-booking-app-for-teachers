begin;
select plan(7);

insert into public.allowed_emails (email, role)
  values ('teacher@example.com', 'teacher'), ('other@example.com', 'teacher'), ('boss@example.com', 'admin');
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'teacher@example.com', '{"full_name":"Mari Maasikas"}'),
  ('00000000-0000-0000-0000-00000000000c', 'other@example.com', '{"full_name":"Jaan Tamm"}'),
  ('00000000-0000-0000-0000-00000000000b', 'boss@example.com', '{"full_name":"Informaatika Õpetaja"}');

-- Teacher
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';

select is(
  (select full_name from public.profile_names where id = '00000000-0000-0000-0000-00000000000c'),
  'Jaan Tamm', 'teacher reads another user''s name');
select is(
  (select count(*)::int from public.profile_names where id in (
    '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b',
    '00000000-0000-0000-0000-00000000000c')),
  3, 'teacher reads every user''s name');
select is(
  (select count(*)::int from public.profiles where id = '00000000-0000-0000-0000-00000000000c'), 0,
  'teacher cannot read another user''s email or role');
select is(
  (select email || ' ' || role from public.profiles where id = '00000000-0000-0000-0000-00000000000a'),
  'teacher@example.com teacher', 'teacher still reads own email and role');
select throws_ok(
  $$ select email from public.profile_names $$,
  '42703', null, 'the names view has no email column');
select throws_ok(
  $$ update public.profile_names set full_name = 'Muudetud' $$,
  '42501', null, 'teacher cannot change names through the view');

-- Signed out
reset role;
set local role anon;
select throws_ok(
  $$ select count(*) from public.profile_names $$,
  '42501', null, 'signed-out user cannot read names');

reset role;
select * from finish();
rollback;
