-- DESTRUCTIVE. Drops every object the migrations create, with all data in them.
--
-- This exists because the schema is still being applied by hand and a clean
-- re-run is easier than patching a partial one. Once there are real printers,
-- spools, and attempt history in this database, delete this file. Losing the
-- record of a failed run is the one thing the data model exists to prevent.
--
-- Does NOT touch auth.users. See the note at the bottom.

begin;

-- Trigger on auth.users first -- it is outside the public schema and will not
-- fall to the drops below.
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists handle_new_auth_user();

drop view if exists owner_usage;
drop view if exists printer_reliability;
drop view if exists printer_service_status;

-- Child tables first, though cascade would handle it either way.
drop table if exists attempt cascade;
drop table if exists maintenance_log cascade;
drop table if exists job cascade;
drop table if exists spool cascade;
drop table if exists printer cascade;
drop table if exists owner cascade;
drop table if exists app_user cascade;

-- Dropping the tables removes them from supabase_realtime automatically.

drop function if exists on_attempt_start();
drop function if exists on_attempt_finalise();
drop function if exists guard_printer_available();
drop function if exists guard_spool_sufficient();
drop function if exists touch_job_updated_at();
drop function if exists is_staff();
drop function if exists is_admin();
drop function if exists can_operate();
-- Before the types, since this one takes a user_role argument.
drop function if exists current_role_is(user_role);

drop type if exists failure_reason;
drop type if exists attempt_outcome;
drop type if exists job_status;
drop type if exists printer_state;
drop type if exists owner_kind;
drop type if exists user_role;

-- Restore the default grants the realtime migration revoked. These are catalog
-- settings, not table properties, so dropping the tables does not reset them.
-- The bundle re-revokes on the next run.
alter default privileges in schema public grant all on tables    to anon;
alter default privileges in schema public grant all on sequences to anon;
alter default privileges in schema public grant all on functions to anon;

commit;

-- auth.users is deliberately untouched -- dropping app_user does not remove
-- anyone's login. But the provisioning trigger only fires on INSERT, so any
-- account that already exists will NOT get a new app_user row when you re-run
-- the bundle. For each existing user, either delete and recreate them in
-- Authentication -> Users, or insert the row by hand:
--
--   insert into app_user (id, email, full_name, role)
--   select id, email, split_part(email, '@', 1), 'operator' from auth.users;
--
--   update app_user set role = 'admin' where email = 'you@hc.edu';
