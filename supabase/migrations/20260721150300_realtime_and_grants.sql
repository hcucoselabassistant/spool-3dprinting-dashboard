-- Realtime and grant hygiene.

-- Two TAs on the floor share the same timeline. Without these the floor view
-- goes stale between refreshes and double-starts become possible.
alter publication supabase_realtime add table attempt;
alter publication supabase_realtime add table job;

-- Realtime respects RLS, but only if the row payload can be matched against a
-- policy; replica identity full ships the whole row on update and delete.
alter table attempt replica identity full;
alter table job     replica identity full;

-- Nobody reaches this database unauthenticated. Supabase grants anon broad
-- access to the public schema by default; nothing here is public-facing, so
-- take it back. Views are security_invoker, so authenticated access is still
-- governed by each table's RLS policies.
revoke all on all tables    in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon;

alter default privileges in schema public revoke all on tables    from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke all on functions from anon;
