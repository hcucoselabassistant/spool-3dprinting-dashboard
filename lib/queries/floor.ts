import { createClient } from "@/lib/supabase/server";
import { LOW_SPOOL_GRAMS, PICKUP_STALE_HOURS } from "@/lib/config";
import type { Database } from "@/lib/database.types";

type JobStatus = Database["public"]["Enums"]["job_status"];

export type TimelineRow = {
  printerId: string;
  printerName: string;
  state: Database["public"]["Enums"]["printer_state"];
  attempt: {
    id: string;
    jobId: string;
    jobTitle: string;
    estGrams: number | null;
    startedAt: string;
    expectedEnd: string;
  } | null;
};

/**
 * A queued job may not be estimated yet -- the operator supplies the slicer
 * numbers at approval or, at the latest, in the start dialog.
 */
export type QueueJob = {
  id: string;
  title: string;
  material: string;
  estMinutes: number | null;
  estGrams: number | null;
  neededBy: string | null;
  priority: number;
  ownerName: string;
  hasFailedAttempt: boolean;
};

/**
 * The merged needs-attention list. One heterogeneous list ordered by urgency,
 * not five panels -- a TA reads it top to bottom and works down. `rank` is the
 * sort key; lower is more urgent.
 */
export type AttentionItem =
  | {
      kind: "overdue_attempt";
      rank: 0;
      attemptId: string;
      jobId: string;
      jobTitle: string;
      estGrams: number | null;
      printerName: string;
      expectedEnd: string;
    }
  | {
      kind: "failed_job";
      rank: 1;
      jobId: string;
      jobTitle: string;
      ownerName: string;
      material: string;
      estMinutes: number | null;
      estGrams: number | null;
    }
  | {
      kind: "stale_pickup";
      rank: 2;
      jobId: string;
      jobTitle: string;
      ownerName: string;
      ownerEmail: string | null;
      shelf: string | null;
      readySince: string;
    }
  | {
      kind: "low_spool";
      rank: 3;
      spoolId: string;
      material: string;
      colorName: string;
      remaining: number;
    }
  | {
      kind: "service_due";
      rank: 4;
      printerId: string;
      printerName: string;
      hours: number;
      interval: number;
    };

export type FloorData = {
  summary: {
    printing: number;
    queued: number;
    awaitingPickup: number;
    down: number;
  };
  timeline: TimelineRow[];
  attention: AttentionItem[];
  queue: QueueJob[];
};

const ACTIVE_STATUSES: JobStatus[] = ["ready_for_pickup"];

export async function getFloorData(): Promise<FloorData> {
  const supabase = await createClient();
  const now = new Date();
  const staleBefore = new Date(
    now.getTime() - PICKUP_STALE_HOURS * 3_600_000,
  ).toISOString();

  const [
    printers,
    liveAttempts,
    queuedJobs,
    failedAttempts,
    pickupJobs,
    lowSpools,
    service,
  ] = await Promise.all([
    supabase.from("printer").select("id, name, state").neq("state", "retired").order("name"),
    supabase
      .from("attempt")
      .select("id, job_id, started_at, expected_end, printer_id, job(title, est_grams)")
      .is("ended_at", null),
    supabase
      .from("job")
      .select("id, title, material, est_minutes, est_grams, needed_by, priority, owner(display_name)")
      .eq("status", "queued"),
    supabase.from("attempt").select("job_id").eq("outcome", "failed"),
    supabase
      .from("job")
      .select("id, title, shelf_location, updated_at, owner(display_name, email)")
      .in("status", ACTIVE_STATUSES),
    supabase
      .from("spool")
      .select("id, material, color_name, remaining_grams")
      .eq("retired", false)
      .gt("remaining_grams", 0)
      .lte("remaining_grams", LOW_SPOOL_GRAMS)
      .order("remaining_grams"),
    supabase.from("printer_service_status").select("*"),
  ]);

  for (const result of [printers, liveAttempts, queuedJobs, failedAttempts, pickupJobs, lowSpools, service]) {
    if (result.error) throw result.error;
  }

  const attemptByPrinter = new Map(
    (liveAttempts.data ?? []).map((a) => [a.printer_id, a]),
  );

  const timeline: TimelineRow[] = (printers.data ?? []).map((printer) => {
    const attempt = attemptByPrinter.get(printer.id);
    return {
      printerId: printer.id,
      printerName: printer.name,
      state: printer.state,
      attempt: attempt
        ? {
            id: attempt.id,
            jobId: attempt.job_id,
            jobTitle: attempt.job?.title ?? "untitled",
            estGrams: attempt.job?.est_grams ?? null,
            startedAt: attempt.started_at,
            expectedEnd: attempt.expected_end,
          }
        : null,
    };
  });

  const failedJobIds = new Set(
    (failedAttempts.data ?? []).map((row) => row.job_id),
  );

  const queue: QueueJob[] = (queuedJobs.data ?? [])
    .map((job) => ({
      id: job.id,
      title: job.title,
      material: job.material,
      estMinutes: job.est_minutes,
      estGrams: job.est_grams,
      neededBy: job.needed_by,
      priority: job.priority,
      ownerName: job.owner?.display_name ?? "unknown",
      hasFailedAttempt: failedJobIds.has(job.id),
    }))
    // priority desc, then soonest deadline (nulls last), then oldest.
    .sort((a, b) => {
      if (a.priority !== b.priority) return b.priority - a.priority;
      if (a.neededBy !== b.neededBy) {
        if (a.neededBy === null) return 1;
        if (b.neededBy === null) return -1;
        return a.neededBy < b.neededBy ? -1 : 1;
      }
      return 0;
    });

  const attention: AttentionItem[] = [];

  const nowIso = now.toISOString();
  for (const a of liveAttempts.data ?? []) {
    if (a.expected_end < nowIso) {
      const printer = (printers.data ?? []).find((p) => p.id === a.printer_id);
      attention.push({
        kind: "overdue_attempt",
        rank: 0,
        attemptId: a.id,
        jobId: a.job_id,
        jobTitle: a.job?.title ?? "untitled",
        estGrams: a.job?.est_grams ?? null,
        printerName: printer?.name ?? "?",
        expectedEnd: a.expected_end,
      });
    }
  }

  for (const job of queue) {
    if (job.hasFailedAttempt) {
      attention.push({
        kind: "failed_job",
        rank: 1,
        jobId: job.id,
        jobTitle: job.title,
        ownerName: job.ownerName,
        material: job.material,
        estMinutes: job.estMinutes,
        estGrams: job.estGrams,
      });
    }
  }

  for (const job of pickupJobs.data ?? []) {
    if (job.updated_at < staleBefore) {
      attention.push({
        kind: "stale_pickup",
        rank: 2,
        jobId: job.id,
        jobTitle: job.title,
        ownerName: job.owner?.display_name ?? "unknown",
        ownerEmail: job.owner?.email ?? null,
        shelf: job.shelf_location,
        readySince: job.updated_at,
      });
    }
  }

  for (const spool of lowSpools.data ?? []) {
    attention.push({
      kind: "low_spool",
      rank: 3,
      spoolId: spool.id,
      material: spool.material,
      colorName: spool.color_name,
      remaining: spool.remaining_grams,
    });
  }

  for (const row of service.data ?? []) {
    if (
      row.state !== "retired" &&
      row.service_interval_hours &&
      (row.hours_since_service ?? 0) >= row.service_interval_hours
    ) {
      attention.push({
        kind: "service_due",
        rank: 4,
        printerId: row.printer_id ?? "",
        printerName: row.name ?? "?",
        hours: row.hours_since_service ?? 0,
        interval: row.service_interval_hours,
      });
    }
  }

  attention.sort((a, b) => a.rank - b.rank);

  return {
    summary: {
      printing: liveAttempts.data?.length ?? 0,
      queued: queue.length,
      awaitingPickup: pickupJobs.data?.length ?? 0,
      down: (printers.data ?? []).filter((p) => p.state === "maintenance").length,
    },
    timeline,
    attention,
    queue,
  };
}
