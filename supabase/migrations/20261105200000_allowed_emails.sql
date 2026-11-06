-- Access is limited to an admin-managed email allow-list. Enforcing it in a trigger on
-- auth.users means a refused person never gets an account, whatever the client does.

create table public.allowed_emails (
  email text primary key check (email = lower(email)),
  role public.user_role not null default 'teacher'
);

-- No client access yet: the admin UI (issue #21) adds the policies it needs.
revoke all on public.allowed_emails from anon, authenticated;
alter table public.allowed_emails enable row level security;

create function public.create_profile_for_allowed_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  allowed public.allowed_emails;
begin
  select * into allowed from public.allowed_emails where email = lower(new.email);
  if not found then
    -- Rolls back the auth.users insert, so the person gets no account.
    raise exception 'email_not_allowed';
  end if;

  insert into public.profiles (id, email, full_name, role)
  values (new.id, lower(new.email), new.raw_user_meta_data ->> 'full_name', allowed.role);
  return new;
end;
$$;

revoke execute on function public.create_profile_for_allowed_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.create_profile_for_allowed_user();
