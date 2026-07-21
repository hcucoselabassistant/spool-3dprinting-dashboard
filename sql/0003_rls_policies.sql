-- Everyone who can log in is staff. Operators run the floor; admins also manage
-- inventory, printers, owners, and other users.

create or replace function current_role_is(required user_role) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from app_user
    where id = auth.uid() and active
      and (role = required or role = 'admin')
  );
$$;

create or replace function is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from app_user where id = auth.uid() and active);
$$;

alter table app_user        enable row level security;
alter table owner           enable row level security;
alter table printer         enable row level security;
alter table spool           enable row level security;
alter table job             enable row level security;
alter table attempt         enable row level security;
alter table maintenance_log enable row level security;

-- Read: any active staff member sees everything.
create policy staff_read_app_user   on app_user        for select using (is_staff());
create policy staff_read_owner      on owner           for select using (is_staff());
create policy staff_read_printer    on printer         for select using (is_staff());
create policy staff_read_spool      on spool           for select using (is_staff());
create policy staff_read_job        on job             for select using (is_staff());
create policy staff_read_attempt    on attempt         for select using (is_staff());
create policy staff_read_maint      on maintenance_log for select using (is_staff());

-- Operators run the day-to-day floor.
create policy op_write_job on job
  for all using (current_role_is('operator')) with check (current_role_is('operator'));

create policy op_write_attempt on attempt
  for all using (current_role_is('operator')) with check (current_role_is('operator'));

create policy op_write_maint on maintenance_log
  for all using (current_role_is('operator')) with check (current_role_is('operator'));

-- Operators may change printer state (to flag one down) but not create or delete.
create policy op_update_printer on printer
  for update using (current_role_is('operator')) with check (current_role_is('operator'));

-- Operators may decrement spools implicitly via triggers; explicit spool edits
-- and all inventory creation are admin-only.
create policy admin_all_printer on printer
  for all using (current_role_is('admin')) with check (current_role_is('admin'));

create policy admin_all_spool on spool
  for all using (current_role_is('admin')) with check (current_role_is('admin'));

create policy admin_all_owner on owner
  for all using (current_role_is('admin')) with check (current_role_is('admin'));

create policy admin_all_app_user on app_user
  for all using (current_role_is('admin')) with check (current_role_is('admin'));
