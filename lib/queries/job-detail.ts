import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

type Job = Database["public"]["Tables"]["job"]["Row"];

export type AttemptHistoryItem = {
  id: string;
  startedAt: string;
  endedAt: string | null;
  outcome: Database["public"]["Enums"]["attempt_outcome"] | null;
  failureReason: Database["public"]["Enums"]["failure_reason"] | null;
  actualGrams: number | null;
  notes: string | null;
  printerName: string;
  spoolLabel: string;
  operatorName: string;
};

export type JobDetail = {
  job: Job;
  ownerName: string;
  ownerEmail: string | null;
  submittedByName: string;
  attempts: AttemptHistoryItem[];
};

/**
 * A job with its full attempt history. The history is the reason the schema is
 * shaped the way it is -- it is the answer to "why did this take three tries" --
 * so it is returned in full and ordered oldest-first for reading top to bottom.
 */
export async function getJobDetail(id: string): Promise<JobDetail | null> {
  const supabase = await createClient();

  const { data: job, error } = await supabase
    .from("job")
    .select(
      "*, owner(display_name, email), submitted_by_user:app_user!job_submitted_by_fkey(full_name)",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (!job) return null;

  const { data: attempts, error: attemptError } = await supabase
    .from("attempt")
    .select(
      "id, started_at, ended_at, outcome, failure_reason, actual_grams, notes, printer(name), spool(material, color_name, brand), operator:app_user!attempt_started_by_fkey(full_name)",
    )
    .eq("job_id", id)
    .order("started_at", { ascending: true });

  if (attemptError) throw attemptError;

  // The row carries owner and submitted_by_user joins on top of every job
  // column, so it is structurally a Job -- the extra keys are harmless.
  return {
    job,
    ownerName: job.owner?.display_name ?? "unknown",
    ownerEmail: job.owner?.email ?? null,
    submittedByName: job.submitted_by_user?.full_name ?? "unknown",
    attempts: (attempts ?? []).map((a) => ({
      id: a.id,
      startedAt: a.started_at,
      endedAt: a.ended_at,
      outcome: a.outcome,
      failureReason: a.failure_reason,
      actualGrams: a.actual_grams,
      notes: a.notes,
      printerName: a.printer?.name ?? "unknown printer",
      spoolLabel: a.spool
        ? `${a.spool.material} ${a.spool.color_name}${a.spool.brand ? ` (${a.spool.brand})` : ""}`
        : "unknown spool",
      operatorName: a.operator?.full_name ?? "unknown",
    })),
  };
}

/**
 * A short-lived signed URL for the uploaded file. The bucket is private, so a
 * plain public URL would 400 -- staff download through a signed link instead.
 */
export async function getJobFileUrl(path: string): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from("job-files")
    .createSignedUrl(path, 300);
  if (error) return null;
  return data.signedUrl;
}
