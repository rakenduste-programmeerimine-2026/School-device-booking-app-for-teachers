-- Admins archive a device instead of deleting it, so its old bookings keep their device.
-- Null means active. Admins archive and restore through the existing admin-only update policy.
alter table public.device_types add column archived_at timestamptz;

-- Decision for lowering total_quantity below what is already booked: the change is allowed
-- and existing bookings stay, because devices really do break. Availability shows 0 free,
-- never a negative number, and the admin resolves the overbooked dates in the overview.

-- Enforced on the table rather than in each write function, so every booking path
-- (#8 and later) gets it. The #8 functions lock the device_types row FOR UPDATE, which
-- also serialises a booking against a concurrent archive of the same device.
create function public.reject_booking_for_archived_device()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Any edit that keeps the same device stays allowed, so existing bookings of an archived
  -- device can still be corrected. Who may make which edit is checked in the #8+ functions.
  if tg_op = 'UPDATE' and new.device_type_id = old.device_type_id then
    return new;
  end if;

  if exists (
    select 1 from public.device_types
    where id = new.device_type_id and archived_at is not null
  ) then
    raise exception 'device_type_archived';
  end if;
  return new;
end;
$$;

revoke execute on function public.reject_booking_for_archived_device() from public, anon, authenticated;

create trigger bookings_reject_archived_device
  before insert or update of device_type_id on public.bookings
  for each row execute function public.reject_booking_for_archived_device();
