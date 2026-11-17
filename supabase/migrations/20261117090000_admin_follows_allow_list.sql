-- profiles.role was only set at sign-up, so removing or demoting an admin left them with
-- admin rights (and a removed admin's token, valid up to 1 h, could re-add their own email).
-- The allow-list is now the source of truth for admin checks, so removal takes effect at once.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    join public.allowed_emails a on a.email = p.email
    where p.id = (select auth.uid()) and a.role = 'admin'
  );
$$;

-- Same function as before plus the role sync, so the profile role shown in the app
-- (home page, /haldus redirect) follows the allow-list.
create or replace function public.sync_access_with_allow_list()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op in ('DELETE', 'UPDATE') and old.role = 'admin'
     and not exists (select 1 from public.allowed_emails where role = 'admin') then
    raise exception 'last_admin';
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    update public.profiles set role = new.role where email = new.email;
  end if;

  if tg_op = 'UPDATE' and old.email = new.email then
    return null;
  end if;

  if tg_op in ('DELETE', 'UPDATE') then
    update auth.users
      set banned_until = now() + interval '100 years'
      where lower(email) = old.email;
    delete from auth.sessions
      where user_id in (select id from auth.users where lower(email) = old.email);
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    update auth.users
      set banned_until = null
      where lower(email) = new.email and banned_until > now() + interval '99 years';
  end if;

  return null;
end;
$$;
