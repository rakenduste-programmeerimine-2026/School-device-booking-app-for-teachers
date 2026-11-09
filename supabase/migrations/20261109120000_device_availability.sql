-- Free quantity of every bookable device for one time range, for the device picker (#10).
-- Takes a Tallinn wall-clock date and times so the UTC offset (and the DST change) is
-- resolved here, in one place, instead of in every caller.
-- Reuses available_quantity from #8, so the picker and create_booking count capacity the
-- same way (peak use, half-open ranges, never below 0).
-- A read, not a write: it runs as the caller under the bookings read policy.
create function public.device_availability(p_date date, p_starts time, p_ends time)
returns table (id bigint, name text, total_quantity integer, free_quantity integer)
language sql
stable
set search_path = ''
as $$
  select
    d.id,
    d.name,
    d.total_quantity,
    public.available_quantity(
      d.id,
      (p_date + p_starts) at time zone 'Europe/Tallinn',
      (p_date + p_ends) at time zone 'Europe/Tallinn'
    )
  from public.device_types d
  where d.archived_at is null
  order by d.name;
$$;

-- Supabase grants new functions to anon by default, so revoke it explicitly.
revoke execute on function public.device_availability(date, time, time) from public, anon;
grant execute on function public.device_availability(date, time, time) to authenticated;
