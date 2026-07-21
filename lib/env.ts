// NEXT_PUBLIC_* vars are inlined at build time only when referenced as static
// property accesses. Do not rewrite these as process.env[name] lookups -- that
// silently yields undefined in the browser bundle.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function supabaseEnv(): { url: string; anonKey: string } {
  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
        "Copy .env.example to .env.local and fill in the values from your " +
        "Supabase project settings.",
    );
  }
  return { url, anonKey };
}
