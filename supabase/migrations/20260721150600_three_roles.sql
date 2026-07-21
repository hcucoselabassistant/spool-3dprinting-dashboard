-- Three roles, replacing the original "any active staff sees everything" model.
--
--   admin    -- everything, including creating accounts and setting roles.
--   operator -- everything except account management: the floor, printers,
--               inventory, owners, and full control of every job.
--   ta       -- creates jobs and owners; reads every job but edits only their
--               own; no access to printers, inventory, reports, or other staff.
--
-- RLS is the real boundary. The app's role checks and hidden nav are only there
-- so a TA gets a locked door instead of a silent empty result.

alter type user_role add value if not exists 'ta';

-- Helpers. None reference the literal 'ta', so this migration never uses the
-- new enum value within its own transaction -- Postgres forbids using a value
-- added to a pre-existing enum in the same transaction.
create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from app_user
    where id = auth.uid() and active and role = 'admin'
  );
$$;

create or replace function can_operate() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from app_user
    where id = auth.uid() and active and role in ('admin', 'operator')
  );
$$;

-- Unchanged in meaning (any active staff), restated so this file is complete.
create or replace function is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from app_user where id = auth.uid() and active);
$$;

-- Out with the two-role policies.
drop policy if exists staff_read_app_user on app_user;
drop policy if exists admin_all_app_user   on app_user;
drop policy if exists staff_read_owner   on owner;
drop policy if exists admin_all_owner     on owner;
drop policy if exists staff_read_printer on printer;
drop policy if exists op_update_printer   on printer;
drop policy if exists admin_all_printer   on printer;
drop policy if exists staff_read_spool   on spool;
drop policy if exists admin_all_spool     on spool;
drop policy if exists staff_read_job      on job;
drop policy if exists op_write_job        on job;
drop policy if exists staff_read_attempt on attempt;
drop policy if exists op_write_attempt    on attempt;
drop policy if exists staff_read_maint   on maintenance_log;
drop policy if exists op_write_maint      on maintenance_log;

-- app_user: a TA sees only their own row. Operators and admins see all staff
-- (names show up in job and attempt history). Only admins create or change
-- accounts, which includes setting roles.
create policy app_user_read_self_or_operate on app_user
  for select using (id = auth.uid() or can_operate());
create policy app_user_admin_write on app_user
  for all using (is_admin()) with check (is_admin());

-- owner: every staffer reads owners and creates them (a TA adds a student
-- mid-submission). Editing or deactivating an existing owner is operator/admin.
create policy owner_read on owner
  for select using (is_staff());
create policy owner_create on owner
  for insert with check (is_staff());
create policy owner_operate_update on owner
  for update using (can_operate()) with check (can_operate());
create policy owner_operate_delete on owner
  for delete using (can_operate());

-- printer, spool, maintenance_log: operator/admin only. A TA has no access at
-- all -- not even read.
create policy printer_operate_all on printer
  for all using (can_operate()) with check (can_operate());
create policy spool_operate_all on spool
  for all using (can_operate()) with check (can_operate());
create policy maint_operate_all on maintenance_log
  for all using (can_operate()) with check (can_operate());

-- job: all staff read every job. Anyone creates a job as themselves. Operators
-- and admins update any job (they drive the status machine); a TA updates only
-- the jobs they submitted. Nobody deletes a job -- there is no delete policy.
create policy job_read on job
  for select using (is_staff());
create policy job_create_own on job
  for insert with check (submitted_by = auth.uid());
create policy job_update on job
  for update
  using (can_operate() or submitted_by = auth.uid())
  with check (can_operate() or submitted_by = auth.uid());

-- attempt: all staff read (attempt history shows on job detail, which every
-- staffer can open). Only operators and admins write -- starting and finishing
-- a print is their work.
create policy attempt_read on attempt
  for select using (is_staff());
create policy attempt_operate_write on attempt
  for all using (can_operate()) with check (can_operate());

-- owner_usage feeds the owners page, which TAs can see -- including per-owner
-- cost, which is derived from spool prices a TA cannot read. Flip the view to
-- run with definer rights so the aggregate computes regardless. It exposes only
-- rolled-up totals per owner, never the spool inventory, and anon was already
-- revoked. This relies on public signup staying disabled, which the
-- provisioning trigger already requires.
alter view owner_usage set (security_invoker = off);

-- New accounts start as the least-privileged role. An admin promotes
-- deliberately.
create or replace function handle_new_auth_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into app_user (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      split_part(new.email, '@', 1)
    ),
    'ta'
  )
  on conflict (id) do nothing;
  return new;
end $$;

-- The old two-role helper is unreferenced now.
drop function if exists current_role_is(user_role);
