-- Estimates move from intake to the operator.
--
-- A TA taking a request at the desk does not have a slicer open. The operator
-- who approves and runs the print does. So a job may now be submitted with no
-- est_minutes / est_grams, and the operator supplies them at approval or, at
-- the latest, in the start-print dialog.
--
-- The estimates are still required before anything runs: the queue needs grams
-- to pick a spool that can cover the print, and minutes to compute
-- attempt.expected_end, which is not null. That rule is enforced below.

alter table job alter column est_minutes drop not null;
alter table job alter column est_grams   drop not null;

-- The `est_minutes > 0` / `est_grams > 0` check constraints are left alone. A
-- check that evaluates to NULL passes, so they keep rejecting zero and negative
-- numbers while allowing "not estimated yet".

-- guard_spool_sufficient compared remaining_grams against job.est_grams. With a
-- nullable estimate that comparison is NULL, which is not true, so the guard
-- would have waved an unestimated job straight onto a printer and the spool
-- would have been debited against nothing. Refuse it explicitly instead.
--
-- The app blocks this first with a better sentence. This is the boundary an
-- operator hitting the API directly also hits, and it is what makes "a job that
-- has ever printed is fully estimated" true in the data rather than by
-- convention.
create or replace function guard_spool_sufficient() returns trigger
language plpgsql security invoker set search_path = public as $$
declare remaining integer; needed integer; minutes integer;
begin
  select remaining_grams into remaining from spool where id = new.spool_id;
  select est_grams, est_minutes into needed, minutes from job where id = new.job_id;
  if needed is null or minutes is null then
    raise exception 'This job has no print estimate yet. Add minutes and grams before starting it.';
  end if;
  if remaining < needed then
    raise exception 'Spool has %g remaining but job needs %g', remaining, needed;
  end if;
  return new;
end $$;
