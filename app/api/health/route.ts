import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

// Keep-alive target for UptimeRobot. Supabase pauses a free project on database
// inactivity, not HTTP inactivity, so this deliberately runs a real query. A
// static 200 would let the database pause while the ping kept succeeding.
//
// The query reads nothing sensitive: a HEAD-style count on printer, which RLS
// leaves empty for an unauthenticated caller. The point is to touch Postgres,
// not to return data -- so an anonymous monitor gets 200 without a session.

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("printer")
      .select("id", { count: "exact", head: true });

    if (error) {
      return NextResponse.json(
        { ok: false, db: "error" },
        { status: 503 },
      );
    }
    return NextResponse.json({ ok: true, db: "up" });
  } catch {
    return NextResponse.json({ ok: false, db: "unreachable" }, { status: 503 });
  }
}
