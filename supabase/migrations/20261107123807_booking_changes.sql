-- Change history for bookings, so admins can see who changed what and when.

create type public.booking_change_action as enum ('created', 'updated', 'deleted');

-- booking_id and series_id have no foreign keys on purpose: history must survive
-- deleting the booking or its whole series.
create table public.booking_changes (
  id bigint generated always as identity primary key,
  booking_id bigint not null,
  series_id bigint not null,
  -- Null only if the person's profile is later removed, or for writes made without a
  -- signed-in user (for example maintenance as postgres).
  changed_by uuid references public.profiles (id) on delete set null,
  changed_at timestamptz not null default now(),
  action public.booking_change_action not null,
  old_data jsonb,
  new_data jsonb,
  constraint booking_changes_data_matches_action check (
    (action = 'created' and old_data is null and new_data is not null)
    or (action = 'updated' and old_data is not null and new_data is not null)
    or (action = 'deleted' and old_data is not null and new_data is null)
  )
);

-- Clients only read, and RLS limits reading to admins. No client role may write,
-- so the history cannot be edited or erased from the app.
revoke all on public.booking_changes from anon, authenticated;
grant select on public.booking_changes to authenticated;

alter table public.booking_changes enable row level security;

create policy "Admins read booking changes"
  on public.booking_changes for select to authenticated
  using ((select public.is_admin()));

-- A trigger rather than an insert in each write function, so #8, #15 and #18 cannot
-- forget it and bulk edits are covered row by row. It runs in the write's transaction,
-- so a rolled-back write leaves no history. It fires for cascade deletes from a series too.
-- Not SECURITY DEFINER on purpose: it runs as the writer. Booking writes come from the
-- SECURITY DEFINER functions, so this works; a write as a client role fails closed. Do not
-- "fix" that by granting INSERT on booking_changes to clients.
create function public.record_booking_change()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  changed_row public.bookings := coalesce(new, old);
begin
  -- Bulk edits may touch rows without changing them; those are not history.
  if tg_op = 'UPDATE' and old is not distinct from new then
    return null;
  end if;

  insert into public.booking_changes (booking_id, series_id, changed_by, action, old_data, new_data)
  values (
    changed_row.id,
    changed_row.series_id,
    auth.uid(),
    case tg_op
      when 'INSERT' then 'created'
      when 'UPDATE' then 'updated'
      else 'deleted'
    end::public.booking_change_action,
    case when tg_op = 'INSERT' then null else to_jsonb(old) end,
    case when tg_op = 'DELETE' then null else to_jsonb(new) end
  );
  return null;
end;
$$;

revoke execute on function public.record_booking_change() from public, anon, authenticated;

create trigger bookings_record_change
  after insert or update or delete on public.bookings
  for each row execute function public.record_booking_change();
