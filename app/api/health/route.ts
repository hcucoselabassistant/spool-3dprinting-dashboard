import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { supabaseEnv } from "@/lib/env";

// Keep-alive target for UptimeRobot. Supabase pauses a free project on database
// inactivity, not HTTP inactivity, so this deliberately runs a real query. A
// static 200 would let the database pause while the ping kept succeeding.
//
// It calls health_ping() -- a no-data function the anon role is granted (see
// migration 20260721150800). Anon has no table privileges, so a table read here
// would be a permission error; the function is the anon-callable way to touch
// Postgres. No session, so an anonymous monitor gets a straight answer.

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { url, anonKey } = supabaseEnv();
    const supabase = createClient(url, anonKey);
    const { error } = await supabase.rpc("health_ping");

    if (error) {
      return NextResponse.json({ ok: false, db: "error" }, { status: 503 });
    }
    return NextResponse.json({ ok: true, db: "up" });
  } catch {
    return NextResponse.json({ ok: false, db: "unreachable" }, { status: 503 });
  }
}
