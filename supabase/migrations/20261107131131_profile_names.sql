-- Teachers need to see who booked what, but not other users' emails or roles.
-- RLS works per row, not per column, so profiles stays limited to the own row (admins: all),
-- and this view exposes only the name of every profile.

-- security_invoker = false on purpose: the view reads profiles with its owner's rights,
-- which is what lets it show other users' rows. That is safe only because it exposes
-- nothing but id and full_name; never add email or role here.
create view public.profile_names
with (security_invoker = false)
as
  select id, full_name from public.profiles;

revoke all on public.profile_names from public, anon, authenticated;
grant select on public.profile_names to authenticated;
