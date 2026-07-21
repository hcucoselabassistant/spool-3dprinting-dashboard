"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

/**
 * Keeps the floor live. Two TAs work the same printers, and a stale timeline
 * causes double-starts -- see spec/03-screens.md. Any insert, update, or delete
 * on attempt or job re-fetches the server component via router.refresh().
 *
 * Coalesced on a short timer so a burst of changes (a finalise touches attempt,
 * job, spool, and printer in one go) triggers a single refresh, not four.
 */
export function RealtimeRefresh() {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = createClient();

    const refreshSoon = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => router.refresh(), 250);
    };

    const channel = supabase
      .channel("floor")
      .on("postgres_changes", { event: "*", schema: "public", table: "attempt" }, refreshSoon)
      .on("postgres_changes", { event: "*", schema: "public", table: "job" }, refreshSoon)
      .subscribe();

    return () => {
      if (timer.current) clearTimeout(timer.current);
      supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}
