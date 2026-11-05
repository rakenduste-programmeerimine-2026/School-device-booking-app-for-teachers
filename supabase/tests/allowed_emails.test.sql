begin;
select plan(4);

insert into public.allowed_emails (email, role) values ('teacher@example.com', 'teacher'), ('boss@example.com', 'admin');

select throws_ok(
  $$ insert into auth.users (id, email) values (gen_random_uuid(), 'stranger@example.com') $$,
  'email_not_allowed', 'email outside the allow-list gets no account');

insert into auth.users (id, email) values (gen_random_uuid(), 'Teacher@Example.com'), (gen_random_uuid(), 'boss@example.com');

select is((select role from public.profiles where email = 'teacher@example.com'), 'teacher', 'listed teacher gets teacher profile, email matched case-insensitively');
select is((select role from public.profiles where email = 'boss@example.com'), 'admin', 'listed admin gets admin profile');
select is((select count(*)::int from public.profiles where email = 'stranger@example.com'), 0, 'refused email has no profile');

select * from finish();
rollback;
