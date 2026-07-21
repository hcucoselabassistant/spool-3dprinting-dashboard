// NEXT_PUBLIC_* vars are inlined at build time only when referenced as static
// property accesses. Do not rewrite these as process.env[name] lookups -- that
// silently yields undefined in the browser bundle.
const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * The dashboard shows several URLs and only the bare project origin is correct
 * here -- the client appends /auth/v1 and /rest/v1 itself. Pasting the REST URL
 * instead produces a PGRST125 "Invalid path" on every sign-in attempt, which
 * surfaces as "credentials were not accepted" and looks like a password
 * problem. Fail loudly at the source instead.
 */
function normaliseUrl(value: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(
      `NEXT_PUBLIC_SUPABASE_URL is not a valid URL: ${JSON.stringify(value)}`,
    );
  }

  const path = parsed.pathname.replace(/\/+$/, "");
  if (path !== "") {
    throw new Error(
      `NEXT_PUBLIC_SUPABASE_URL must be the bare project URL with no path, ` +
        `but it is "${value}". Use "${parsed.origin}" -- the Project URL from ` +
        `Settings -> API, not the REST or GraphQL URL.`,
    );
  }

  return parsed.origin;
}

export function supabaseEnv(): { url: string; anonKey: string } {
  if (!rawUrl || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
        "Copy .env.example to .env.local and fill in the values from your " +
        "Supabase project settings.",
    );
  }
  return { url: normaliseUrl(rawUrl), anonKey };
}
