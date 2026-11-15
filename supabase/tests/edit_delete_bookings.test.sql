begin;
select plan(45);

-- Fixed ids so seed data cannot interfere. Dates are relative to today, so "past" and "future"
-- stay true whenever the test runs.
insert into public.allowed_emails (email, role) values
  ('teacher-a@example.com', 'teacher'), ('teacher-b@example.com', 'teacher'),
  ('boss@example.com', 'admin'), ('removed@example.com', 'teacher');
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'teacher-a@example.com'),
  ('00000000-0000-0000-0000-0000000000b1', 'teacher-b@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'boss@example.com'),
  ('00000000-0000-0000-0000-00000000000f', 'removed@example.com');
delete from public.allowed_emails where email = 'removed@example.com';
insert into public.device_types (id, name, total_quantity) overriding system value values (9901, 'Test edit laptops', 5);

create function pg_temp.at(days integer, clock time) returns timestamptz language sql as $$
  select ((current_date + days) + clock) at time zone 'Europe/Tallinn'
$$;
-- Teacher A's weekly series: one past date and three future dates, 2 laptops each, 09:00-09:45.
insert into public.booking_series (id, owner_id) overriding system value values
  (9901, '00000000-0000-0000-0000-0000000000a1'),
  (9902, '00000000-0000-0000-0000-0000000000a1'),
  (9903, '00000000-0000-0000-0000-0000000000b1'),
  (9904, '00000000-0000-0000-0000-0000000000a1');
insert into public.bookings (id, series_id, device_type_id, quantity, starts_at, ends_at) overriding system value values
  (9901, 9901, 9901, 2, pg_temp.at(-7, '09:00'), pg_temp.at(-7, '09:45')),
  (9902, 9901, 9901, 2, pg_temp.at(7, '09:00'), pg_temp.at(7, '09:45')),
  (9903, 9901, 9901, 2, pg_temp.at(14, '09:00'), pg_temp.at(14, '09:45')),
  (9904, 9901, 9901, 2, pg_temp.at(21, '09:00'), pg_temp.at(21, '09:45')),
  -- Teacher A's other series, all in the future.
  (9905, 9902, 9901, 1, pg_temp.at(28, '09:00'), pg_temp.at(28, '09:45')),
  -- Teacher B also uses 2 laptops at the time of A's third date.
  (9906, 9903, 9901, 2, pg_temp.at(14, '09:00'), pg_temp.at(14, '09:45')),
  -- Teacher A's series that is entirely in the past.
  (9907, 9904, 9901, 1, pg_temp.at(-14, '09:00'), pg_temp.at(-14, '09:45'));

-- Returns the error and detail of a refused update, so the conflicts can be checked.
create function pg_temp.update_error(p_quantity integer) returns text language plpgsql as $$
declare
  message text;
  detail text;
begin
  perform public.update_bookings(9902, 'series', null, p_quantity);
  return 'updated';
exception when others then
  get stacked diagnostics message = message_text, detail = pg_exception_detail;
  return message || ' ' || coalesce(detail, '');
end;
$$;

-- Function settings
select ok(
  (select bool_and(prosecdef and 'search_path=""' = any(proconfig)) from pg_proc
   where oid in ('public.delete_bookings(bigint,text,bigint[])'::regprocedure,
                 'public.update_bookings(bigint,text,bigint[],integer,time,time)'::regprocedure)),
  'delete_bookings and update_bookings are SECURITY DEFINER with an empty search_path');
select ok(
  not has_function_privilege('anon', 'public.delete_bookings(bigint,text,bigint[])', 'execute')
  and not has_function_privilege('anon', 'public.update_bookings(bigint,text,bigint[],integer,time,time)', 'execute'),
  'anon cannot execute the edit and delete functions');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';

-- Delete: the four scopes
savepoint scenario;
select is(public.delete_bookings(9902, 'one'), 1, 'delete one: returns 1');
select is((select array_agg(id order by id) from public.bookings where series_id = 9901), array[9901::bigint, 9903, 9904],
  'delete one: only that booking is gone');
reset role;
select is((select count(*)::int from public.booking_changes where booking_id = 9902 and action = 'deleted'
           and changed_by = '00000000-0000-0000-0000-0000000000a1'), 1,
  'delete one: the deletion is in the history, recorded as teacher A');
rollback to savepoint scenario;

savepoint scenario;
select is(public.delete_bookings(9903, 'following'), 2, 'delete following: returns 2');
select is((select array_agg(id order by id) from public.bookings where series_id = 9901), array[9901::bigint, 9902],
  'delete following: the clicked booking and later ones are gone, earlier ones stay');
rollback to savepoint scenario;

savepoint scenario;
select is(public.delete_bookings(9903, 'series'), 3, 'delete series: returns 3, the future bookings');
select is((select array_agg(id order by id) from public.bookings where series_id = 9901), array[9901::bigint],
  'delete series: the past booking stays as history');
select is((select count(*)::int from public.booking_series where id = 9901), 1,
  'delete series: a series that still has its past booking is kept');
rollback to savepoint scenario;

savepoint scenario;
select is(public.delete_bookings(9905, 'series'), 1, 'delete series: a fully future series loses its booking');
select is((select count(*)::int from public.booking_series where id = 9902), 0,
  'delete series: a series left without bookings is removed');
rollback to savepoint scenario;

savepoint scenario;
select is(public.delete_bookings(9902, 'selected', array[9902, 9904]::bigint[]), 2, 'delete selected: returns 2');
select is((select array_agg(id order by id) from public.bookings where series_id = 9901), array[9901::bigint, 9903],
  'delete selected: only the chosen dates are gone');
rollback to savepoint scenario;

select throws_ok($$ select public.delete_bookings(9902, 'selected', array[9902, 9905]::bigint[]) $$,
  'P0001', 'invalid_selection', 'selected dates must all belong to the clicked booking''s series');
select throws_ok($$ select public.delete_bookings(9902, 'selected', array[]::bigint[]) $$,
  'P0001', 'invalid_selection', 'an empty selection is refused');
select throws_ok($$ select public.delete_bookings(9902, 'selected', array[9901, 9902]::bigint[]) $$,
  'P0001', 'booking_in_past', 'a selection with a past date is refused');
select throws_ok($$ select public.delete_bookings(9907, 'series') $$,
  'P0001', 'no_bookings', 'a series with only past dates has nothing to delete');
select throws_ok($$ select public.delete_bookings(9902, 'all') $$,
  'P0001', 'invalid_scope', 'an unknown scope is refused');
select throws_ok($$ select public.delete_bookings(999999, 'one') $$,
  'P0001', 'booking_not_found', 'an unknown booking is refused');

-- Past bookings: teachers cannot touch them, an admin can correct one
select throws_ok($$ select public.delete_bookings(9901, 'one') $$,
  'P0001', 'booking_in_past', 'a teacher cannot delete a past booking');
select throws_ok($$ select public.update_bookings(9901, 'one', null, 1) $$,
  'P0001', 'booking_in_past', 'a teacher cannot change a past booking');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}';
savepoint scenario;
select is(public.update_bookings(9901, 'one', null, 1), 1, 'an admin can correct one past booking');
select is((select quantity from public.bookings where id = 9901), 1, 'the past booking now has the corrected quantity');
rollback to savepoint scenario;
savepoint scenario;
select is(public.delete_bookings(9903, 'series'), 3, 'an admin''s series delete also touches only future bookings');
select is((select array_agg(id order by id) from public.bookings where series_id = 9901), array[9901::bigint],
  'the past booking stays after an admin''s series delete');
rollback to savepoint scenario;

-- Decision 6: teacher B cannot change teacher A's bookings, an admin can
savepoint scenario;
select is(public.update_bookings(9902, 'one', null, 1), 1, 'an admin can change another teacher''s booking');
rollback to savepoint scenario;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}';
select throws_ok($$ select public.delete_bookings(9902, 'one') $$,
  'P0001', 'not_allowed', 'teacher B cannot delete teacher A''s booking');
select throws_ok($$ select public.update_bookings(9902, 'series', null, 1) $$,
  'P0001', 'not_allowed', 'teacher B cannot change teacher A''s series');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';

-- Update
savepoint scenario;
select is(public.update_bookings(9902, 'series', null, 3), 3,
  'update series: raising 2 to 3 fits next to teacher B''s 2 (the edited bookings are not counted twice)');
select is((select array_agg(quantity order by id) from public.bookings where series_id = 9901), array[2, 3, 3, 3],
  'update series: future dates have the new quantity, the past date keeps its old one');
reset role;
select is((select count(*)::int from public.booking_changes where action = 'updated' and series_id = 9901
           and changed_by = '00000000-0000-0000-0000-0000000000a1'), 3,
  'update series: every change is in the history, recorded as teacher A');
rollback to savepoint scenario;

savepoint scenario;
select is(public.update_bookings(9903, 'following', null, null, '10:05', '10:50'), 2,
  'update following: moves the clicked booking and later ones to 10:05-10:50');
select ok(
  (select bool_and((starts_at at time zone 'Europe/Tallinn')::time = '10:05'
                   and (ends_at at time zone 'Europe/Tallinn')::time = '10:50')
   from public.bookings where id in (9903, 9904)),
  'update following: the new times are Tallinn wall-clock times');
select is(
  (select array_agg((starts_at at time zone 'Europe/Tallinn')::date order by id) from public.bookings where id in (9903, 9904)),
  array[current_date + 14, current_date + 21],
  'update following: each booking keeps its own date');
select is((select (starts_at at time zone 'Europe/Tallinn')::time from public.bookings where id = 9902), '09:00'::time,
  'update following: earlier bookings keep their time');
rollback to savepoint scenario;

select is(pg_temp.update_error(4), 'insufficient_capacity [{"booking_id": 9903, "free_quantity": 3}]',
  'a quantity that no longer fits on one date is refused, and the detail names that booking');
select is((select array_agg(quantity order by id) from public.bookings where series_id = 9901), array[2, 2, 2, 2],
  'the refused update changed no booking, not even the dates that fit');

select throws_ok($$ select public.update_bookings(9902, 'one') $$,
  'P0001', 'nothing_to_change', 'an update without new values is refused');
select throws_ok($$ select public.update_bookings(9902, 'one', null, 0) $$,
  'P0001', 'invalid_quantity', 'a quantity below 1 is refused');
select throws_ok($$ select public.update_bookings(9902, 'one', null, null, '10:00', null) $$,
  'P0001', 'invalid_range', 'a new start without a new end is refused');
select throws_ok($$ select public.update_bookings(9902, 'one', null, null, '11:00', '10:00') $$,
  'P0001', 'invalid_range', 'a new end before the new start is refused');

-- Not signed in, removed from the allow-list, or anon
set local request.jwt.claims = '{"role":"authenticated"}';
select throws_ok($$ select public.delete_bookings(9902, 'one') $$,
  'P0001', 'not_authenticated', 'a request without a user is refused');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000f","role":"authenticated"}';
select throws_ok($$ select public.update_bookings(9902, 'one', null, 1) $$,
  'P0001', 'access_revoked', 'a user removed from the allow-list is refused');
reset role;
set local role anon;
select throws_ok($$ select public.delete_bookings(9902, 'one') $$,
  '42501', null, 'anon cannot call delete_bookings');
reset role;

select * from finish();
rollback;
