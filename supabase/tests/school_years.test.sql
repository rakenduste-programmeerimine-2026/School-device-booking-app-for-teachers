begin;
select plan(14);

insert into public.allowed_emails (email, role)
  values ('teacher@example.com', 'teacher'), ('boss@example.com', 'admin');
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'teacher@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'boss@example.com');
insert into public.school_years (starts_on, ends_on) values ('2026-09-01', '2027-06-05');
insert into public.non_teaching_periods (school_year_id, kind, name, starts_on, ends_on)
  select id, 'break', 'Jõuluvaheaeg', '2026-12-23', '2027-01-02' from public.school_years;

-- Date ranges
select throws_ok(
  $$ insert into public.school_years (starts_on, ends_on) values ('2027-06-05', '2026-09-01') $$,
  '23514', null, 'school year ending before it starts is rejected');
select throws_ok(
  $$ insert into public.school_years (starts_on, ends_on) values ('2026-09-01', '2026-09-01') $$,
  '23514', null, 'school year with no length is rejected');
select throws_ok(
  $$ insert into public.school_years (starts_on, ends_on) values ('2027-06-05', '2028-06-05') $$,
  '23P01', null, 'school years sharing a day are rejected');
select throws_ok(
  $$ insert into public.non_teaching_periods (school_year_id, kind, name, starts_on, ends_on)
     select id, 'break', 'Vigane', '2027-03-28', '2027-03-22' from public.school_years $$,
  '23514', null, 'period ending before it starts is rejected');
select lives_ok(
  $$ insert into public.non_teaching_periods (school_year_id, kind, name, starts_on, ends_on)
     select id, 'public_holiday', 'Iseseisvuspäev', '2027-02-24', '2027-02-24' from public.school_years $$,
  'one-day period is allowed');

-- Teacher: read only
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';

select is((select count(*)::int from public.school_years), 1, 'teacher reads school years');
select is((select count(*)::int from public.non_teaching_periods), 2, 'teacher reads non-teaching periods');
select throws_ok(
  $$ insert into public.school_years (starts_on, ends_on) values ('2027-09-01', '2028-06-05') $$,
  '42501', null, 'teacher cannot add a school year');
select throws_ok(
  $$ insert into public.non_teaching_periods (school_year_id, kind, name, starts_on, ends_on)
     select id, 'day_off', 'Teacher', '2027-05-01', '2027-05-01' from public.school_years $$,
  '42501', null, 'teacher cannot add a non-teaching period');
update public.non_teaching_periods set name = 'Muudetud';
delete from public.school_years;

-- Admin: can write
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}';

select is(
  (select count(*)::int from public.non_teaching_periods where name = 'Muudetud'), 0,
  'teacher update changed no rows');
select is((select count(*)::int from public.school_years), 1, 'teacher delete removed no rows');
select lives_ok(
  $$ insert into public.non_teaching_periods (school_year_id, kind, name, starts_on, ends_on)
     select id, 'day_off', 'Õppetöövaba päev', '2027-05-03', '2027-05-03' from public.school_years $$,
  'admin adds a non-teaching period');
update public.school_years set ends_on = '2027-06-10';
select is((select ends_on from public.school_years), '2027-06-10'::date, 'admin updates the school year');

-- Signed out
reset role;
set local role anon;
select throws_ok(
  $$ select count(*) from public.school_years $$,
  '42501', null, 'signed-out user cannot read school years');

reset role;
select * from finish();
rollback;
