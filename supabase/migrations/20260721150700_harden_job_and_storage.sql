-- Security hardening found in review. Both close direct-API bypasses that the
-- app UI never exposes but an authenticated TA could reach with their own JWT.

-- 1. job.status may only be changed by an operator/admin -- except a submitter
--    cancelling their own job. Without this, the job_update RLS policy (which
--    can't restrict columns) lets a TA PATCH status on their own job and
--    self-approve, skipping operator approval and the quota gate.
--
--    The attempt-driven transitions are safe: they run inside operator actions,
--    where can_operate() is true. TAs cannot write attempts at all.
create or replace function guard_job_status_transition() returns trigger
language plpgsql security invoker set search_path = public as $$
begin
  if can_operate() then
    return new;
  end if;
  if new.status = 'cancelled' and old.submitted_by = auth.uid() then
    return new;
  end if;
  raise exception 'You do not have permission to change this job''s status.';
end $$;

create trigger job_guard_status
  before update on job
  for each row
  when (new.status is distinct from old.status)
  execute function guard_job_status_transition();

-- 2. Tighten the job-files bucket. Staff still upload (their own jobs) and read
--    (all jobs are staff-readable), but:
--    - update is operator/admin only (the app never updates a file anyway);
--    - delete is the uploader or an operator, so a TA's orphan-cleanup of their
--      own failed upload still works, but a TA cannot wipe other jobs' files.
--    storage.objects.owner is the uploader's uid.
drop policy if exists "staff update job files" on storage.objects;
drop policy if exists "staff delete job files" on storage.objects;

create policy "operate update job files" on storage.objects
  for update using (bucket_id = 'job-files' and public.can_operate())
  with check (bucket_id = 'job-files' and public.can_operate());

create policy "delete own or operate job files" on storage.objects
  for delete using (
    bucket_id = 'job-files'
    and (owner = auth.uid() or public.can_operate())
  );
