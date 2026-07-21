import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "@/lib/database.types";
import { supabaseEnv } from "@/lib/env";

/**
 * Browser client. Needed for Realtime subscriptions on attempt and job
 * (see spec/03-screens.md). Reads and writes still go through Server
 * Components and Server Actions.
 */
export function createClient() {
  const { url, anonKey } = supabaseEnv();
  return createBrowserClient<Database>(url, anonKey);
}
