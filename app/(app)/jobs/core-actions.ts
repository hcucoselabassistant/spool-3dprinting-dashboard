"use server";

import { revalidatePath } from "next/cache";

import { canOperate, requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

type FailureReason = Database["public"]["Enums"]["failure_reason"];
type AttemptOutcome = Database["public"]["Enums"]["attempt_outcome"];

export type ActionState = {
  error: string | null;
  ok?: boolean;
  /** Set when approval would exceed the owner's quota. The UI surfaces this and
   *  offers to override -- quota is a warning, never a block. */
  quotaWarning?: string;
};

const OK: ActionState = { error: null, ok: true };

/**
 * The whole status machine -- approve, start, finish, ready, collect -- is
 * operator/admin work. A TA has no part in running the floor.
 */
async function requireOperator(): Promise<string | null> {
  const staff = await requireStaff();
  return canOperate(staff)
    ? null
    : "Only operators can run jobs through the floor.";
}

function revalidateLoop() {
  revalidatePath("/jobs");
  revalidatePath("/printers");
  revalidatePath("/inventory");
  revalidatePath("/");
}

/**
 * Approve: submitted -> queued. Operator-driven, so the app writes job.status
 * directly. This is one of the four transitions that are NOT the trigger's.
 *
 * At approval, successful grams already used are checked against the owner's
 * quota. Over quota WARNS but never BLOCKS -- the alternative is a student's
 * coursework stuck at 11pm with nobody to appeal to (spec/02-workflows.md). The
 * first call returns the warning; a second call with override=true proceeds and
 * logs who overrode what.
 */
export async function approveJob(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const denied = await requireOperator();
  if (denied) return { error: denied };
  const staff = await requireStaff();
  const id = formData.get("job_id");
  const override = formData.get("override") === "true";
  if (typeof id !== "string") return { error: "Missing job id." };

  const supabase = await createClient();

  const { data: job, error: jobError } = await supabase
    .from("job")
    .select("est_grams, owner_id, status")
    .eq("id", id)
    .single();
  if (jobError) return { error: jobError.message };
  if (job.status !== "submitted") {
    return { error: `This job is ${job.status}, not awaiting approval.` };
  }

  if (!override) {
    const [{ data: owner }, { data: usage }] = await Promise.all([
      supabase.from("owner").select("display_name, quota_grams").eq("id", job.owner_id).single(),
      supabase.from("owner_usage").select("grams_success").eq("owner_id", job.owner_id).maybeSingle(),
    ]);

    if (owner?.quota_grams != null) {
      const used = usage?.grams_success ?? 0;
      const after = used + job.est_grams;
      if (after > owner.quota_grams) {
        return {
          error: null,
          quotaWarning:
            `${owner.display_name} has used ${used} g of a ${owner.quota_grams} g quota. ` +
            `Approving this adds ${job.est_grams} g, reaching ${after} g. Approve anyway?`,
        };
      }
    }
  }

  const { error } = await supabase
    .from("job")
    .update({ status: "queued" })
    .eq("id", id)
    .eq("status", "submitted");

  if (error) return { error: error.message };

  if (override) {
    // No override-log table in v1; the server log is the record. Build the
    // trigger point, log it, stop there -- same rule as notifications.
    console.warn(
      `[quota override] ${staff.full_name} (${staff.id}) approved job ${id} over its owner's quota.`,
    );
  }

  revalidateLoop();
  return OK;
}

/**
 * Start a print. This is the ONLY thing the app does -- it inserts an attempt.
 * The triggers move the job to printing and the printer to printing.
 *
 * The insert can raise: printer down, spool short, another live attempt on the
 * printer. Those messages are already human-readable, so they are surfaced as
 * written rather than being second-guessed by a pre-check that could drift.
 */
export async function startPrint(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const denied = await requireOperator();
  if (denied) return { error: denied };
  const staff = await requireStaff();

  const jobId = formData.get("job_id");
  const printerId = formData.get("printer_id");
  const spoolId = formData.get("spool_id");

  if (typeof jobId !== "string") return { error: "Missing job id." };
  if (typeof printerId !== "string" || printerId === "") {
    return { error: "Pick a printer." };
  }
  if (typeof spoolId !== "string" || spoolId === "") {
    return { error: "Pick a spool." };
  }

  const supabase = await createClient();

  const { data: job, error: jobError } = await supabase
    .from("job")
    .select("est_minutes, status")
    .eq("id", jobId)
    .single();

  if (jobError) return { error: jobError.message };
  if (job.status !== "queued") {
    return { error: `This job is ${job.status}, not queued — reload the page.` };
  }

  const expectedEnd = new Date(
    Date.now() + job.est_minutes * 60_000,
  ).toISOString();

  const { error } = await supabase.from("attempt").insert({
    job_id: jobId,
    printer_id: printerId,
    spool_id: spoolId,
    started_by: staff.id,
    expected_end: expectedEnd,
  });

  if (error) return { error: humanizeAttemptError(error.message) };

  revalidateLoop();
  return OK;
}

/**
 * Finish a print. Updates the attempt with all three finalisation columns at
 * once -- attempt_finalised_together requires them to be set together. The
 * trigger then decrements the spool, frees the printer, and advances the job.
 *
 * The app never writes job.status here. Success goes to post_processing and a
 * failure returns to queued, both by trigger.
 */
export async function finishAttempt(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const denied = await requireOperator();
  if (denied) return { error: denied };

  const attemptId = formData.get("attempt_id");
  const outcome = formData.get("outcome");
  const actualGramsRaw = formData.get("actual_grams");
  const failureReason = formData.get("failure_reason");
  const notes = formData.get("notes");

  if (typeof attemptId !== "string") return { error: "Missing attempt id." };
  if (!isOutcome(outcome)) {
    return { error: "Choose an outcome: success, failed, or cancelled." };
  }

  const actualGrams =
    typeof actualGramsRaw === "string"
      ? Number.parseInt(actualGramsRaw, 10)
      : NaN;
  if (!Number.isFinite(actualGrams) || actualGrams < 0) {
    return { error: "Enter the grams actually used — even a rough figure." };
  }

  // failure_reason may only be set when the outcome is 'failed', and the
  // database enforces it too (attempt_failure_reason_only_on_failure).
  let reason: FailureReason | null = null;
  if (outcome === "failed") {
    if (!isFailureReason(failureReason)) {
      return { error: "Pick why it failed." };
    }
    reason = failureReason;
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("attempt")
    .update({
      ended_at: new Date().toISOString(),
      outcome,
      actual_grams: actualGrams,
      failure_reason: reason,
      notes: typeof notes === "string" && notes.trim() !== "" ? notes.trim() : null,
    })
    .eq("id", attemptId)
    .is("ended_at", null); // refuse to re-finalise an already-closed attempt

  if (error) return { error: error.message };
  revalidateLoop();
  return OK;
}

/**
 * post_processing -> ready_for_pickup, with the shelf location. Operator-driven.
 */
export async function markReady(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const denied = await requireOperator();
  if (denied) return { error: denied };

  const id = formData.get("job_id");
  const shelf = formData.get("shelf_location");

  if (typeof id !== "string") return { error: "Missing job id." };
  if (typeof shelf !== "string" || shelf.trim() === "") {
    return { error: "Where is it? A shelf location is how it gets found." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("job")
    .update({ status: "ready_for_pickup", shelf_location: shelf.trim() })
    .eq("id", id)
    .eq("status", "post_processing");

  if (error) return { error: error.message };
  revalidateLoop();
  return OK;
}

/**
 * ready_for_pickup -> collected. Records the handover and stamps collected_at.
 */
export async function markCollected(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const denied = await requireOperator();
  if (denied) return { error: denied };
  const id = formData.get("job_id");
  if (typeof id !== "string") return { error: "Missing job id." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("job")
    .update({ status: "collected", collected_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "ready_for_pickup");

  if (error) return { error: error.message };
  revalidateLoop();
  return OK;
}

/**
 * Cancel a job. Reachable only from submitted, queued, or post_processing --
 * never from printing, where you cancel the attempt instead (which returns the
 * job to queued). The reason is appended to notes; the schema has no dedicated
 * column for it and this keeps the record without a migration.
 *
 * Operators cancel any job; a TA may cancel one they submitted. This is the one
 * status change a TA is allowed, and it matches the job_update RLS policy.
 */
export async function cancelJob(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const staff = await requireStaff();

  const id = formData.get("job_id");
  const reason = formData.get("reason");

  if (typeof id !== "string") return { error: "Missing job id." };
  if (typeof reason !== "string" || reason.trim() === "") {
    return { error: "Give a reason — it is the only record of why." };
  }

  const supabase = await createClient();
  const { data: job, error: readError } = await supabase
    .from("job")
    .select("status, notes, submitted_by")
    .eq("id", id)
    .single();

  if (readError) return { error: readError.message };
  if (!canOperate(staff) && job.submitted_by !== staff.id) {
    return { error: "You can only cancel jobs you submitted." };
  }
  if (!["submitted", "queued", "post_processing"].includes(job.status)) {
    return {
      error:
        job.status === "printing"
          ? "This job is printing. Cancel the print from the finish dialog instead."
          : `A ${job.status} job cannot be cancelled.`,
    };
  }

  const stamped = `[cancelled: ${reason.trim()}]`;
  const notes = job.notes ? `${job.notes}\n${stamped}` : stamped;

  const { error } = await supabase
    .from("job")
    .update({ status: "cancelled", notes })
    .eq("id", id)
    .eq("status", job.status);

  if (error) return { error: error.message };
  revalidateLoop();
  return OK;
}

function isOutcome(value: FormDataEntryValue | null): value is AttemptOutcome {
  return value === "success" || value === "failed" || value === "cancelled";
}

function isFailureReason(
  value: FormDataEntryValue | null,
): value is FailureReason {
  return (
    value === "adhesion" ||
    value === "layer_shift" ||
    value === "clog" ||
    value === "filament_runout" ||
    value === "power_loss" ||
    value === "model_error" ||
    value === "operator_error" ||
    value === "other"
  );
}

/** The Postgres guards already speak English; just strip the SQL context line. */
function humanizeAttemptError(message: string): string {
  return message.split("\n")[0].replace(/^ERROR:\s*/i, "");
}
