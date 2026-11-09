-- Live availability (#12): the picker listens for Postgres Changes on bookings and re-renders
-- on every event. Realtime only sends changes for tables in this publication, and it checks
-- the subscriber's RLS read policy on bookings before delivering an event.
alter publication supabase_realtime add table public.bookings;
