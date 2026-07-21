-- Job status and printer state are consequences of attempts, not manual edits.

create or replace function touch_job_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger job_touch_updated_at
  before update on job
  for each row execute function touch_job_updated_at();

-- Starting an attempt puts the job and printer into 'printing'.
--
-- security definer is load-bearing. Trigger functions run as the invoking user,
-- so without it these cascading updates are filtered by the target table's RLS
-- policies and silently affect zero rows -- no error, just missing state.
create or replace function on_attempt_start() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update job     set status = 'printing' where id = new.job_id;
  update printer set state  = 'printing' where id = new.printer_id;
  return new;
end $$;

create trigger attempt_start
  after insert on attempt
  for each row execute function on_attempt_start();

-- Finalising an attempt decrements the spool, frees the printer, and advances
-- the job. Filament is consumed on failure too.
--
-- security definer for the same reason as on_attempt_start, and it matters most
-- here: operators have no write policy on spool, so an operator finalising a
-- print would record actual_grams while the spool never decremented.
create or replace function on_attempt_finalise() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.ended_at is null and new.ended_at is not null then

    update spool
       set remaining_grams = greatest(0, remaining_grams - new.actual_grams),
           retired = (greatest(0, remaining_grams - new.actual_grams) = 0)
     where id = new.spool_id;

    update printer
       set state = case when state = 'printing' then 'available' else state end
     where id = new.printer_id;

    update job
       set status = case new.outcome
                      when 'success'   then 'post_processing'::job_status
                      when 'failed'    then 'queued'::job_status
                      when 'cancelled' then 'queued'::job_status
                    end
     where id = new.job_id;
  end if;
  return new;
end $$;

create trigger attempt_finalise
  after update on attempt
  for each row execute function on_attempt_finalise();

-- Guard: never start a print on a printer that is down or retired.
create or replace function guard_printer_available() returns trigger
language plpgsql as $$
declare s printer_state;
begin
  select state into s from printer where id = new.printer_id;
  if s in ('maintenance', 'retired') then
    raise exception 'Printer % is % and cannot accept jobs', new.printer_id, s;
  end if;
  return new;
end $$;

create trigger attempt_guard_printer
  before insert on attempt
  for each row execute function guard_printer_available();

-- Guard: don't start a print the spool cannot cover.
create or replace function guard_spool_sufficient() returns trigger
language plpgsql as $$
declare remaining integer; needed integer;
begin
  select remaining_grams into remaining from spool where id = new.spool_id;
  select est_grams       into needed    from job   where id = new.job_id;
  if remaining < needed then
    raise exception 'Spool has %g remaining but job needs %g', remaining, needed;
  end if;
  return new;
end $$;

create trigger attempt_guard_spool
  before insert on attempt
  for each row execute function guard_spool_sufficient();
