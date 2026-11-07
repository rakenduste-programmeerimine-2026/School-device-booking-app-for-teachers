begin;
select plan(11);

insert into public.allowed_emails (email, role)
  values ('teacher@example.com', 'teacher'), ('boss@example.com', 'admin');
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'teacher@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'boss@example.com');
insert into public.lesson_periods (lesson_number, starts_at, ends_at) values (1, '08:15', '09:00');

-- Constraints
select throws_ok(
  $$ insert into public.lesson_periods (lesson_number, starts_at, ends_at) values (1, '09:10', '09:55') $$,
  '23505', null, 'duplicate lesson number is rejected');
select throws_ok(
  $$ insert into public.lesson_periods (lesson_number, starts_at, ends_at) values (2, '09:55', '09:10') $$,
  '23514', null, 'lesson ending before it starts is rejected');
select throws_ok(
  $$ insert into public.lesson_periods (lesson_number, starts_at, ends_at) values (2, '09:10', '09:10') $$,
  '23514', null, 'lesson with no length is rejected');

-- Teacher: read only
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';

select is((select count(*)::int from public.lesson_periods), 1, 'teacher reads lesson periods');
select throws_ok(
  $$ insert into public.lesson_periods (lesson_number, starts_at, ends_at) values (2, '09:10', '09:55') $$,
  '42501', null, 'teacher cannot add a lesson');
update public.lesson_periods set ends_at = '09:30';
delete from public.lesson_periods;

-- Admin: can write
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}';

select is((select ends_at from public.lesson_periods), '09:00'::time, 'teacher update changed no rows');
select is((select count(*)::int from public.lesson_periods), 1, 'teacher delete removed no rows');
select lives_ok(
  $$ insert into public.lesson_periods (lesson_number, starts_at, ends_at) values (2, '09:10', '09:55') $$,
  'admin adds a lesson');
update public.lesson_periods set ends_at = '09:05' where lesson_number = 1;
select is((select ends_at from public.lesson_periods where lesson_number = 1), '09:05'::time,
  'admin updates a lesson');
delete from public.lesson_periods where lesson_number = 2;
select is((select count(*)::int from public.lesson_periods), 1, 'admin deletes a lesson');

-- Signed out
reset role;
set local role anon;
select throws_ok(
  $$ select count(*) from public.lesson_periods $$,
  '42501', null, 'signed-out user cannot read lesson periods');

reset role;
select * from finish();
rollback;
