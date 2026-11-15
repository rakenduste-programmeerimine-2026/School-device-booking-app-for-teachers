-- Commit of a recurring booking: all dates or none. It takes the same input as preview_series,
-- and availability may have changed since the preview, so every date is checked again here.

-- Input rules shared by preview and commit, so the two can never disagree about valid input.
create function public.check_series_dates(p_dates jsonb)
returns void
language plpgsql
stable
set search_path = ''
as $$
declare
  bad_quantity boolean;
  bad_range boolean;
begin
  -- A full school year with three lessons every weekday is about 600 dates. The cap keeps a
  -- hand-built request from making the overlap check (every pair of dates) arbitrarily slow.
  if p_dates is null or jsonb_typeof(p_dates) <> 'array' or jsonb_array_length(p_dates) > 1000 then
    raise exception 'invalid_dates';
  end if;

  select
    coalesce(bool_or(d.quantity is null or d.quantity <= 0), false),
    coalesce(bool_or(d.starts_at is null or d.ends_at is null or d.starts_at >= d.ends_at), false)
  into bad_quantity, bad_range
  from public.series_dates_from_json(p_dates) as d;
  if bad_quantity then
    raise exception 'invalid_quantity';
  end if;
  if bad_range then
    raise exception 'invalid_range';
  end if;

  -- Overlapping dates in one series would compete with each other, which checking each date
  -- against existing bookings cannot show. A teacher who needs more raises the quantity instead.
  if exists (
    select 1
    from public.series_dates_from_json(p_dates) as a
    join public.series_dates_from_json(p_dates) as b on a.date_position < b.date_position
      and a.starts_at < b.ends_at and b.starts_at < a.ends_at
  ) then
    raise exception 'overlapping_dates';
  end if;
end;
$$;

-- Only the booking functions call it, so no client role may.
revoke execute on function public.check_series_dates(jsonb) from public, anon, authenticated;

-- Same behaviour as before; the input checks now live in check_series_dates.
create or replace function public.preview_series(p_device_type_id bigint, p_dates jsonb)
returns table (
  date_position integer,
  starts_at timestamptz,
  ends_at timestamptz,
  quantity integer,
  free_quantity integer,
  has_conflict boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  caller uuid := auth.uid();
  device public.device_types;
begin
  if caller is null then
    raise exception 'not_authenticated';
  end if;
  -- Same as create_booking: a removed user's token stays valid for up to an hour.
  if not exists (
    select 1 from public.profiles
    join public.allowed_emails on allowed_emails.email = profiles.email
    where profiles.id = caller
  ) then
    raise exception 'access_revoked';
  end if;

  select * into device from public.device_types where id = p_device_type_id;
  if not found then
    raise exception 'device_type_not_found';
  end if;
  if device.archived_at is not null then
    raise exception 'device_type_archived';
  end if;

  perform public.check_series_dates(p_dates);

  -- available_quantity is what create_booking checks against: peak use, half-open, never below 0.
  return query
    select d.date_position, d.starts_at, d.ends_at, d.quantity, free.quantity, free.quantity < d.quantity
    from public.series_dates_from_json(p_dates) as d
    cross join lateral (
      select public.available_quantity(p_device_type_id, d.starts_at, d.ends_at) as quantity
    ) as free
    order by d.date_position;
end;
$$;

-- Writes one series owned by the caller with a booking per date, and returns the series id.
-- If any date lacks capacity it raises insufficient_capacity with the conflicts as JSON in the
-- detail, [{"date_position": 3, "free_quantity": 1}, ...]. Raising rolls back the whole call, so
-- a failed commit can never leave part of a series behind.
-- History is written by the bookings trigger; this function must not insert into booking_changes.
create function public.commit_series(p_device_type_id bigint, p_dates jsonb)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  device public.device_types;
  conflicts jsonb;
  new_series_id bigint;
begin
  if caller is null then
    raise exception 'not_authenticated';
  end if;
  -- Same as create_booking: a removed user's token stays valid for up to an hour.
  if not exists (
    select 1 from public.profiles
    join public.allowed_emails on allowed_emails.email = profiles.email
    where profiles.id = caller
  ) then
    raise exception 'access_revoked';
  end if;

  -- The row lock makes a concurrent booking or commit for this device wait until this one ends,
  -- so nobody can take capacity between the check below and the inserts.
  select * into device from public.device_types where id = p_device_type_id for update;
  if not found then
    raise exception 'device_type_not_found';
  end if;
  if device.archived_at is not null then
    raise exception 'device_type_archived';
  end if;

  perform public.check_series_dates(p_dates);
  -- An empty preview is fine, but an empty series would be a series with no bookings.
  if jsonb_array_length(p_dates) = 0 then
    raise exception 'invalid_dates';
  end if;

  select jsonb_agg(
           jsonb_build_object('date_position', d.date_position, 'free_quantity', d.free_quantity)
           order by d.date_position)
  into conflicts
  from (
    select s.date_position, s.quantity,
           public.available_quantity(p_device_type_id, s.starts_at, s.ends_at) as free_quantity
    from public.series_dates_from_json(p_dates) as s
  ) as d
  where d.free_quantity < d.quantity;
  if conflicts is not null then
    raise exception 'insufficient_capacity' using detail = conflicts::text;
  end if;

  insert into public.booking_series (owner_id) values (caller)
    returning id into new_series_id;
  insert into public.bookings (series_id, device_type_id, quantity, starts_at, ends_at)
    select new_series_id, p_device_type_id, d.quantity, d.starts_at, d.ends_at
    from public.series_dates_from_json(p_dates) as d
    order by d.date_position;

  return new_series_id;
end;
$$;

revoke execute on function public.commit_series(bigint, jsonb) from public, anon;
grant execute on function public.commit_series(bigint, jsonb) to authenticated;
