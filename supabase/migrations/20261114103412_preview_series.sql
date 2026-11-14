-- Preview of a recurring booking: free quantity and conflicts per date, before anything is
-- written. Dates come from the app's generator (frontend/lib/series-dates.ts), which already
-- handles Europe/Tallinn, DST and breaks, so they are not generated a second time here.
-- p_dates is a JSON array of {starts_at, ends_at, quantity}; the series commit (#15) takes the
-- same input, so the UI sends one payload to both. A quantity per date lets the teacher lower
-- it on a single conflicting date and preview again.

-- Turns the JSON list into rows, numbered from 1 in input order. Shared with the commit (#15).
-- It is parsed on each use rather than into a temporary table, because a preview must not write.
create function public.series_dates_from_json(p_dates jsonb)
returns table (date_position integer, starts_at timestamptz, ends_at timestamptz, quantity integer)
language sql
stable
set search_path = ''
as $$
  select
    e.ordinality::integer,
    (e.item ->> 'starts_at')::timestamptz,
    (e.item ->> 'ends_at')::timestamptz,
    (e.item ->> 'quantity')::integer
  from jsonb_array_elements(p_dates) with ordinality as e (item, ordinality);
$$;

-- Only the booking functions call it, so no client role may.
revoke execute on function public.series_dates_from_json(jsonb) from public, anon, authenticated;

create function public.preview_series(p_device_type_id bigint, p_dates jsonb)
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
  bad_quantity boolean;
  bad_range boolean;
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

  if p_dates is null or jsonb_typeof(p_dates) <> 'array' then
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

revoke execute on function public.preview_series(bigint, jsonb) from public, anon;
grant execute on function public.preview_series(bigint, jsonb) to authenticated;
