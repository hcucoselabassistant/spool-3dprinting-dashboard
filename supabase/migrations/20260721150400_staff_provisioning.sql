-- Staff provisioning.
--
-- Creating a TA account was: add the user, copy their auth uuid by hand, insert
-- a matching app_user row. Six chances to paste the wrong uuid. This makes the
-- app_user row appear automatically.
--
-- SECURITY: this grants operator access to every new auth.users row, so it is
-- only safe while public signup is disabled. Turn it off at
--   Authentication -> Sign In / Providers -> Email -> "Allow new users to sign up"
-- With signup off, the only way an auth.users row appears is an admin creating
-- it in the dashboard, which is the intent. If you ever re-enable public signup,
-- drop this trigger first or anyone with an email address becomes staff.

create or replace function handle_new_auth_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into app_user (id, email, full_name, role)
  values (
    new.id,
    new.email,
    -- Dashboard-created users have no metadata, so fall back to the local part
    -- of the address. Admins can correct the name afterwards.
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      split_part(new.email, '@', 1)
    ),
    -- Never 'admin'. Promote deliberately, with the statement below.
    'operator'
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_auth_user();

-- Promote someone to admin:
--   update app_user set role = 'admin' where email = 'you@hc.edu';
--
-- Revoke access without deleting history (app_user is referenced by job and
-- attempt, so deleting is blocked on purpose):
--   update app_user set active = false where email = 'former-ta@hc.edu';
