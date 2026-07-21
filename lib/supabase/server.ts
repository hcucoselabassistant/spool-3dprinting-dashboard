import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import type { Database } from "@/lib/database.types";
import { supabaseEnv } from "@/lib/env";

/**
 * Request-scoped Supabase client for Server Components and Server Actions.
 * Every query made through this client carries the caller's session, so the
 * RLS policies in supabase/migrations are what actually enforce access.
 */
export async function createClient() {
  const cookieStore = await cookies();
  const { url, anonKey } = supabaseEnv();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot set cookies. Harmless -- proxy.ts refreshes
          // the session on every request, so the write here is redundant.
        }
      },
    },
  });
}
