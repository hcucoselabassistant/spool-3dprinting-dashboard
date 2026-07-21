-- Keep-alive ping for /api/health.
--
-- The health endpoint runs unauthenticated (as the anon role), and
-- 20260721150300 revoked every anon privilege on public objects. So a plain
-- "select from <table>" as anon is a hard permission error, not an RLS-empty
-- result -- which is why the endpoint reported db:"error".
--
-- This is a dedicated no-data function the anon role may call. Executing it is a
-- real query against Postgres, so it keeps a free-tier project awake, but it
-- touches no table and returns nothing sensitive.

create or replace function public.health_ping() returns boolean
language sql stable as $$ select true $$;

grant execute on function public.health_ping() to anon, authenticated;
