-- The allow-list was only checked when an account was created. Removing an email now
-- blocks that user and ends their sessions; adding it back restores access. Nothing is
-- deleted, so the user's profile, bookings and booking history stay.

-- SECURITY DEFINER because the admin UI (#21) will edit allowed_emails as a client role,
-- which has no rights on the auth schema.
create function public.sync_access_with_allow_list()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- A role change keeps the same email; it must not log the user out.
  if tg_op = 'UPDATE' and old.email = new.email then
    return null;
  end if;

  if tg_op in ('DELETE', 'UPDATE') then
    -- 100 years, like Supabase's own ban; 'infinity' can break Supabase Auth reading the row.
    update auth.users
      set banned_until = now() + interval '100 years'
      where lower(email) = old.email;
    -- Without a session the user cannot refresh their token, so access ends when the
    -- current access token expires (jwt_expiry, 1 hour). Refresh tokens cascade with it.
    delete from auth.sessions
      where user_id in (select id from auth.users where lower(email) = old.email);
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    update auth.users
      set banned_until = null
      where lower(email) = new.email;
  end if;

  return null;
end;
$$;

revoke execute on function public.sync_access_with_allow_list() from public, anon, authenticated;

create trigger allowed_emails_sync_access
  after insert or update or delete on public.allowed_emails
  for each row execute function public.sync_access_with_allow_list();
