import "server-only";

import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";
import { supabaseEnv } from "@/lib/env";

/**
 * Service-role client. Bypasses ALL row-level security, so it is only ever used
 * inside admin-gated Server Actions, after the caller has been confirmed to be
 * an admin against their own session. Never expose it to a route that trusts
 * client input alone.
 *
 * The "server-only" import makes the build fail if this file is ever pulled into
 * a client bundle, which would leak the key.
 */
export function createAdminClient() {
  const { url } = supabaseEnv();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. It is required for in-app user " +
        "management. Add it to .env.local and to the Vercel project settings " +
        "as a server-only variable (no NEXT_PUBLIC_ prefix).",
    );
  }
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
