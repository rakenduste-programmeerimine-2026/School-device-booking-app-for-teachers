-- Free quantity of every bookable device for one time range, for the device picker (#10).
-- Takes a Tallinn wall-clock date and times so the UTC offset (and the DST change) is
-- resolved here, in one place, instead of in every caller.
-- A read, not a write: it runs as the caller under the bookings read policy.
create function public.device_availability(p_date date, p_starts time, p_ends time)
returns table (id bigint, name text, total_quantity integer, free_quantity integer)
language sql
stable
set search_path = ''
as $$
  with requested as (
    select
      (p_date + p_starts) at time zone 'Europe/Tallinn' as starts_at,
      (p_date + p_ends) at time zone 'Europe/Tallinn' as ends_at
  )
  select
    d.id,
    d.name,
    d.total_quantity,
    -- Never below 0: an admin may lower the total under what is already booked.
    greatest(d.total_quantity - coalesce((
      -- Peak concurrent use. Use only rises when a booking starts, so the peak is reached
      -- at the range start or at a booking start inside the range. Summing every
      -- overlapping booking would wrongly add two that overlap the range but not each other.
      -- Ranges are half-open: a booking ending exactly at a point is not in use there.
      select max((
        select sum(active.quantity)
        from public.bookings active
        where active.device_type_id = d.id
          and active.starts_at <= point.at
          and active.ends_at > point.at
      ))
      from (
        select greatest(b.starts_at, r.starts_at) as at
        from public.bookings b
        where b.device_type_id = d.id
          and b.starts_at < r.ends_at
          and b.ends_at > r.starts_at
      ) point
    ), 0), 0)::integer
  from public.device_types d
  cross join requested r
  where d.archived_at is null
  order by d.name;
$$;

revoke execute on function public.device_availability(date, time, time) from public, anon;
grant execute on function public.device_availability(date, time, time) to authenticated;
