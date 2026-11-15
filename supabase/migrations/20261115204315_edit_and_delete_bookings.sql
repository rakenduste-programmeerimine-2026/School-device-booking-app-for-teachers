-- Changing and deleting bookings: one booking, this and all following, a whole series, or
-- selected dates. Every booking belongs to a series, so all four are scopes of one series and
-- share one code path: bookings_in_scope decides who may touch which rows, for both actions.

-- Returns the ids of the bookings a call may change, after every permission and past-booking
-- rule. p_booking_id is the booking the user clicked; p_scope is one of 'one', 'following',
-- 'series' or 'selected' (then p_booking_ids lists the chosen bookings of the same series).
-- It also locks the device row, so a change and a concurrent booking cannot both pass the
-- capacity check.
create function public.bookings_in_scope(p_booking_id bigint, p_scope text, p_booking_ids bigint[])
returns setof bigint
language plpgsql
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  anchor public.bookings;
  owner uuid;
  caller_is_admin boolean;
  ids bigint[];
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

  select * into anchor from public.bookings where id = p_booking_id;
  if not found then
    raise exception 'booking_not_found';
  end if;

  -- Decision 6: teachers change only their own bookings, admins change all.
  select owner_id into owner from public.booking_series where id = anchor.series_id;
  caller_is_admin := public.is_admin();
  if owner <> caller and not caller_is_admin then
    raise exception 'not_allowed';
  end if;

  perform 1 from public.device_types where id = anchor.device_type_id for update;

  -- Decision 7: series-wide changes touch only bookings that have not started. The single
  -- exception is an admin correcting one past booking.
  case p_scope
    when 'one' then
      if anchor.starts_at <= now() and not caller_is_admin then
        raise exception 'booking_in_past';
      end if;
      ids := array[anchor.id];
    when 'following' then
      select array_agg(b.id) into ids from public.bookings b
      where b.series_id = anchor.series_id and b.starts_at >= anchor.starts_at and b.starts_at > now();
    when 'series' then
      select array_agg(b.id) into ids from public.bookings b
      where b.series_id = anchor.series_id and b.starts_at > now();
    when 'selected' then
      if p_booking_ids is null or cardinality(p_booking_ids) = 0 then
        raise exception 'invalid_selection';
      end if;
      if exists (
        select 1 from unnest(p_booking_ids) as chosen (id)
        left join public.bookings b on b.id = chosen.id
        where b.id is null or b.series_id <> anchor.series_id
      ) then
        raise exception 'invalid_selection';
      end if;
      if exists (select 1 from public.bookings b where b.id = any (p_booking_ids) and b.starts_at <= now()) then
        raise exception 'booking_in_past';
      end if;
      ids := p_booking_ids;
    else
      raise exception 'invalid_scope';
  end case;

  if ids is null or cardinality(ids) = 0 then
    raise exception 'no_bookings';
  end if;
  return query select distinct unnest(ids);
end;
$$;

-- Only the booking functions call it, so no client role may.
revoke execute on function public.bookings_in_scope(bigint, text, bigint[]) from public, anon, authenticated;

-- Deletes the bookings in scope and returns how many. A series left without bookings is
-- removed too. History is written by the bookings trigger and survives the delete.
create function public.delete_bookings(p_booking_id bigint, p_scope text, p_booking_ids bigint[] default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  ids bigint[];
  series bigint;
  deleted integer;
begin
  select array_agg(id) into ids from public.bookings_in_scope(p_booking_id, p_scope, p_booking_ids) as id;
  select series_id into series from public.bookings where id = p_booking_id;

  delete from public.bookings where id = any (ids);
  get diagnostics deleted = row_count;

  delete from public.booking_series s
  where s.id = series and not exists (select 1 from public.bookings b where b.series_id = s.id);

  return deleted;
end;
$$;

-- Changes quantity and/or times of the bookings in scope and returns how many. A null
-- argument keeps that value. New times are Tallinn wall-clock times applied on each booking's
-- own date, so moving a series to another lesson stays right across the DST change.
-- Capacity is checked after the update, so the edited bookings are not counted against their
-- own old values. Any conflict raises insufficient_capacity with
-- [{"booking_id": ..., "free_quantity": ...}] in the detail and rolls the whole call back.
-- History is written by the bookings trigger; this function must not insert into booking_changes.
create function public.update_bookings(
  p_booking_id bigint,
  p_scope text,
  p_booking_ids bigint[] default null,
  p_quantity integer default null,
  p_starts_time time default null,
  p_ends_time time default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  ids bigint[];
  total integer;
  conflicts jsonb;
  updated integer;
begin
  if p_quantity is null and p_starts_time is null and p_ends_time is null then
    raise exception 'nothing_to_change';
  end if;
  if p_quantity is not null and p_quantity <= 0 then
    raise exception 'invalid_quantity';
  end if;
  -- Times move together: a new start with the old end could silently invert some dates.
  if (p_starts_time is null) <> (p_ends_time is null) or p_starts_time >= p_ends_time then
    raise exception 'invalid_range';
  end if;

  select array_agg(id) into ids from public.bookings_in_scope(p_booking_id, p_scope, p_booking_ids) as id;

  -- In SET, starts_at still holds the old value, so each booking keeps its own Tallinn date.
  update public.bookings set
    quantity = coalesce(p_quantity, quantity),
    starts_at = case when p_starts_time is null then starts_at
      else ((starts_at at time zone 'Europe/Tallinn')::date + p_starts_time) at time zone 'Europe/Tallinn' end,
    ends_at = case when p_ends_time is null then ends_at
      else ((starts_at at time zone 'Europe/Tallinn')::date + p_ends_time) at time zone 'Europe/Tallinn' end
  where id = any (ids);
  get diagnostics updated = row_count;

  -- Each booking spans its whole range, so its peak minus its own quantity is the others' peak.
  select d.total_quantity into total
  from public.device_types d join public.bookings b on b.device_type_id = d.id
  where b.id = p_booking_id;
  select jsonb_agg(jsonb_build_object('booking_id', c.id, 'free_quantity', c.free_quantity) order by c.starts_at)
  into conflicts
  from (
    select b.id, b.starts_at,
           greatest(total - (public.peak_usage(b.device_type_id, b.starts_at, b.ends_at) - b.quantity), 0) as free_quantity,
           public.peak_usage(b.device_type_id, b.starts_at, b.ends_at) > total as over
    from public.bookings b
    where b.id = any (ids)
  ) as c
  where c.over;
  if conflicts is not null then
    raise exception 'insufficient_capacity' using detail = conflicts::text;
  end if;

  return updated;
end;
$$;

revoke execute on function public.delete_bookings(bigint, text, bigint[]) from public, anon;
revoke execute on function public.update_bookings(bigint, text, bigint[], integer, time, time) from public, anon;
grant execute on function public.delete_bookings(bigint, text, bigint[]) to authenticated;
grant execute on function public.update_bookings(bigint, text, bigint[], integer, time, time) to authenticated;
