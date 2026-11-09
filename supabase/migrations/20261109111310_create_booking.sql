-- Booking with a capacity check. An exclusion constraint cannot express "at most N devices
-- at once", so capacity is enforced inside one transactional function.

-- Highest number of devices in use at the same moment within [p_starts_at, p_ends_at).
-- Summing every overlapping booking would overcount: two bookings that overlap the range
-- but not each other never use devices at the same time.
create function public.peak_usage(p_device_type_id bigint, p_starts_at timestamptz, p_ends_at timestamptz)
returns integer
language sql
stable
set search_path = ''
as $$
  with overlapping as (
    -- Half-open ranges: a booking ending exactly at p_starts_at does not overlap.
    select quantity, starts_at, ends_at
    from public.bookings
    where device_type_id = p_device_type_id
      and starts_at < p_ends_at
      and ends_at > p_starts_at
  ),
  -- Usage only rises when a booking starts, so the peak is at one of these points
  -- (the range start covers bookings that are already running).
  points as (
    select greatest(starts_at, p_starts_at) as point from overlapping
  )
  select coalesce(max(usage), 0)::integer
  from (
    select (
      select sum(quantity) from overlapping
      where starts_at <= points.point and ends_at > points.point
    ) as usage
    from points
  ) as usage_per_point;
$$;

-- Free devices for the UI ("12 of 30 free"). Never negative: an admin may lower the total
-- below what is already booked (decided in #37), and then 0 are free.
create function public.available_quantity(p_device_type_id bigint, p_starts_at timestamptz, p_ends_at timestamptz)
returns integer
language sql
stable
set search_path = ''
as $$
  select greatest(total_quantity - public.peak_usage(p_device_type_id, p_starts_at, p_ends_at), 0)
  from public.device_types
  where id = p_device_type_id;
$$;

-- Creates a single booking as a series of one, so single and bulk edits share one code path.
-- History is written by the bookings trigger; this function must not insert into booking_changes.
create function public.create_booking(
  p_device_type_id bigint,
  p_quantity integer,
  p_starts_at timestamptz,
  p_ends_at timestamptz
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  device public.device_types;
  booked integer;
  new_series_id bigint;
  new_booking_id bigint;
begin
  if caller is null then
    raise exception 'not_authenticated';
  end if;

  -- A removed user's access token stays valid until it expires, so check the allow-list
  -- here too instead of trusting the token.
  if not exists (
    select 1 from public.profiles
    join public.allowed_emails on allowed_emails.email = profiles.email
    where profiles.id = caller
  ) then
    raise exception 'access_revoked';
  end if;

  if p_quantity is null or p_quantity <= 0 then
    raise exception 'invalid_quantity';
  end if;
  if p_starts_at is null or p_ends_at is null or p_starts_at >= p_ends_at then
    raise exception 'invalid_range';
  end if;

  -- The row lock makes concurrent bookings of the same device wait for each other, so two
  -- requests can never both see the same free capacity. It also waits for a concurrent archive.
  select * into device from public.device_types where id = p_device_type_id for update;
  if not found then
    raise exception 'device_type_not_found';
  end if;
  if device.archived_at is not null then
    raise exception 'device_type_archived';
  end if;

  booked := public.peak_usage(p_device_type_id, p_starts_at, p_ends_at);
  if booked + p_quantity > device.total_quantity then
    raise exception 'insufficient_capacity'
      using detail = format('available=%s', greatest(device.total_quantity - booked, 0));
  end if;

  insert into public.booking_series (owner_id) values (caller)
    returning id into new_series_id;
  insert into public.bookings (series_id, device_type_id, quantity, starts_at, ends_at)
    values (new_series_id, p_device_type_id, p_quantity, p_starts_at, p_ends_at)
    returning id into new_booking_id;

  return new_booking_id;
end;
$$;

-- Supabase grants new functions to anon by default, so revoke it explicitly.
revoke execute on function public.peak_usage(bigint, timestamptz, timestamptz) from public, anon;
revoke execute on function public.available_quantity(bigint, timestamptz, timestamptz) from public, anon;
revoke execute on function public.create_booking(bigint, integer, timestamptz, timestamptz) from public, anon;
grant execute on function public.peak_usage(bigint, timestamptz, timestamptz) to authenticated;
grant execute on function public.available_quantity(bigint, timestamptz, timestamptz) to authenticated;
grant execute on function public.create_booking(bigint, integer, timestamptz, timestamptz) to authenticated;
