begin;
select plan(1);

-- Without this the page subscribes fine but never hears about bookings, and nothing fails.
select ok(
  exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'bookings'
  ),
  'bookings changes are published to Realtime');

select * from finish();
rollback;
