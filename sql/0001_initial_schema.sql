-- Print queue: initial schema

create type user_role      as enum ('admin', 'operator');
create type owner_kind     as enum ('student', 'course', 'faculty', 'department');
create type printer_state  as enum ('available', 'printing', 'maintenance', 'retired');
create type job_status     as enum ('submitted', 'queued', 'printing', 'post_processing',
                                    'ready_for_pickup', 'collected', 'cancelled');
create type attempt_outcome as enum ('success', 'failed', 'cancelled');
create type failure_reason  as enum ('adhesion', 'layer_shift', 'clog', 'filament_runout',
                                     'power_loss', 'model_error', 'operator_error', 'other');

-- Staff who log in. id matches auth.users.id.
create table app_user (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null unique,
  full_name   text not null,
  role        user_role not null default 'operator',
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Whoever a print belongs to. Not a login. This is what quotas and billing attach to.
create table owner (
  id           uuid primary key default gen_random_uuid(),
  display_name text not null,
  email        text,
  kind         owner_kind not null default 'student',
  course_code  text,
  quota_grams  integer,                       -- null = unlimited
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);
create index owner_active_idx on owner (active) where active;

create table printer (
  id           uuid primary key default gen_random_uuid(),
  name         text not null unique,          -- e.g. 'mk4-01'
  model        text not null,
  nozzle_mm    numeric(3,1) not null default 0.4,
  build_volume text,
  state        printer_state not null default 'available',
  service_interval_hours integer not null default 250,
  notes        text,
  created_at   timestamptz not null default now()
);

create table spool (
  id              uuid primary key default gen_random_uuid(),
  material        text not null,              -- 'PLA', 'PETG', 'ABS', 'TPU'
  color_name      text not null,
  color_hex       text,
  brand           text,
  total_grams     integer not null check (total_grams > 0),
  remaining_grams integer not null check (remaining_grams >= 0),
  cost_cents      integer not null default 0 check (cost_cents >= 0),
  opened_on       date,
  retired         boolean not null default false,
  created_at      timestamptz not null default now(),
  constraint spool_remaining_lte_total check (remaining_grams <= total_grams)
);
create index spool_available_idx on spool (material, color_name)
  where not retired and remaining_grams > 0;

-- A request. One per thing someone wants printed.
create table job (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references owner(id) on delete restrict,
  submitted_by    uuid not null references app_user(id) on delete restrict,
  title           text not null,
  notes           text,
  file_path       text,                       -- Supabase Storage path to .gcode/.3mf
  material        text not null,
  color_preference text,
  est_minutes     integer not null check (est_minutes > 0),
  est_grams       integer not null check (est_grams > 0),
  needed_by       date,
  priority        integer not null default 0, -- higher sorts first in the queue
  status          job_status not null default 'submitted',
  shelf_location  text,
  collected_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index job_status_idx  on job (status);
create index job_owner_idx   on job (owner_id);
create index job_queue_idx   on job (priority desc, needed_by nulls last, created_at)
  where status in ('submitted', 'queued');

-- One run on one printer. This table is the source of truth for every metric.
create table attempt (
  id             uuid primary key default gen_random_uuid(),
  job_id         uuid not null references job(id) on delete cascade,
  printer_id     uuid not null references printer(id) on delete restrict,
  spool_id       uuid not null references spool(id) on delete restrict,
  started_by     uuid not null references app_user(id) on delete restrict,
  started_at     timestamptz not null default now(),
  expected_end   timestamptz not null,
  ended_at       timestamptz,
  outcome        attempt_outcome,
  failure_reason failure_reason,
  actual_grams   integer check (actual_grams >= 0),
  notes          text,
  constraint attempt_finalised_together check (
    (ended_at is null and outcome is null and actual_grams is null)
    or
    (ended_at is not null and outcome is not null and actual_grams is not null)
  ),
  constraint attempt_failure_reason_only_on_failure check (
    failure_reason is null or outcome = 'failed'
  )
);
create index attempt_job_idx     on attempt (job_id);
create index attempt_printer_idx on attempt (printer_id, started_at desc);
create unique index attempt_one_live_per_printer on attempt (printer_id)
  where ended_at is null;

create table maintenance_log (
  id              uuid primary key default gen_random_uuid(),
  printer_id      uuid not null references printer(id) on delete cascade,
  performed_by    uuid not null references app_user(id) on delete restrict,
  performed_at    timestamptz not null default now(),
  action          text not null,
  hours_at_service numeric(10,2),
  notes           text
);
create index maintenance_printer_idx on maintenance_log (printer_id, performed_at desc);

-- Derived: machine hours accumulated since the last logged service.
create view printer_service_status as
select
  p.id                as printer_id,
  p.name,
  p.state,
  p.service_interval_hours,
  m.last_service_at,
  coalesce(sum(
    extract(epoch from (coalesce(a.ended_at, now()) - a.started_at)) / 3600.0
  ) filter (where a.started_at > coalesce(m.last_service_at, '-infinity'::timestamptz)), 0)
    as hours_since_service
from printer p
left join lateral (
  select max(performed_at) as last_service_at
  from maintenance_log ml where ml.printer_id = p.id
) m on true
left join attempt a on a.printer_id = p.id
group by p.id, p.name, p.state, p.service_interval_hours, m.last_service_at;

-- Derived: reliability per printer, last 90 days.
create view printer_reliability as
select
  p.id   as printer_id,
  p.name,
  count(a.id)                                                as attempts,
  count(a.id) filter (where a.outcome = 'failed')             as failures,
  case when count(a.id) = 0 then 0
       else round(100.0 * count(a.id) filter (where a.outcome = 'failed') / count(a.id), 1)
  end                                                         as failure_rate_pct,
  coalesce(sum(a.actual_grams) filter (where a.outcome = 'failed'), 0) as wasted_grams
from printer p
left join attempt a
  on a.printer_id = p.id
 and a.ended_at > now() - interval '90 days'
group by p.id, p.name;

-- Derived: quota and cost per owner. Failed attempts are counted separately so
-- policy can decide whether to charge them.
create view owner_usage as
select
  o.id as owner_id,
  o.display_name,
  o.course_code,
  o.quota_grams,
  coalesce(sum(a.actual_grams) filter (where a.outcome = 'success'), 0) as grams_success,
  coalesce(sum(a.actual_grams) filter (where a.outcome = 'failed'), 0)  as grams_failed,
  coalesce(sum(
    a.actual_grams * (s.cost_cents::numeric / nullif(s.total_grams, 0))
  ), 0)::integer as cost_cents
from owner o
left join job j     on j.owner_id = o.id
left join attempt a on a.job_id = j.id and a.outcome is not null
left join spool s   on s.id = a.spool_id
group by o.id, o.display_name, o.course_code, o.quota_grams;
