-- The admin page (#21) manages the allow-list as a signed-in admin, so the table gets admin-only
-- policies. Update is not granted: changing a role or address goes through remove and add.
grant select, insert, delete on public.allowed_emails to authenticated;

create policy "Admins read allowed emails"
  on public.allowed_emails for select to authenticated
  using ((select public.is_admin()));

create policy "Admins add allowed emails"
  on public.allowed_emails for insert to authenticated
  with check ((select public.is_admin()));

create policy "Admins remove allowed emails"
  on public.allowed_emails for delete to authenticated
  using ((select public.is_admin()));
