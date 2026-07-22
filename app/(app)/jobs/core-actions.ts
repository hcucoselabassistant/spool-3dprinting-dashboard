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
 * An estimate field: a positive whole number, or null when it was left blank.
 * "invalid" is distinct from blank on purpose -- a typo must complain rather
 * than be silently recorded as "not estimated yet".
 */
type Estimate = number | null | "invalid";

function readEstimate(value: FormDataEntryValue | null): Estimate {
  if (typeof value !== "string" || value.trim() === "") return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : "invalid";
}

/**
 * Minutes and grams are read as a pair everywhere. Half an estimate schedules
 * nothing: grams choose the spool, minutes set attempt.expected_end.
 */
function readEstimatePair(
  formData: FormData,
): { minutes: number; grams: number } | { none: true } | { error: string } {
  const minutes = readEstimate(formData.get("est_minutes"));
  const grams = readEstimate(formData.get("est_grams"));

  if (minutes === "invalid") {
    return { error: "Estimated minutes must be a positive whole number." };
  }
  if (grams === "invalid") {
    return { error: "Estimated grams must be a positive whole number." };
  }
  if (minutes === null && grams === null) return { none: true };
  if (minutes === null || grams === null) {
    return {
      error: "Enter both minutes and grams — half an estimate can't schedule a print.",
    };
  }
  return { minutes, grams };
}

/**
 * The over-quota warning, or null when there is nothing to warn about.
 *
 * It fires at the moment est_grams is first written to a job -- at approval if
 * the operator had the slicer numbers then, otherwise in the start dialog. That
 * keeps it exactly once per job: a job that arrives at start already estimated
 * was warned about at approval.
 */
async function quotaWarningFor(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ownerId: string,
  grams: number,
): Promise<string | null> {
  const [{ data: owner }, { data: usage }] = await Promise.all([
    supabase.from("owner").select("display_name, quota_grams").eq("id", ownerId).single(),
    supabase.from("owner_usage").select("grams_success").eq("owner_id", ownerId).maybeSingle(),
  ]);

  if (owner?.quota_grams == null) return null;

  const used = usage?.grams_success ?? 0;
  const after = used + grams;
  if (after <= owner.quota_grams) return null;

  return (
    `${owner.display_name} has used ${used} g of a ${owner.quota_grams} g quota. ` +
    `This job adds ${grams} g, reaching ${after} g. Continue anyway?`
  );
}

/**
 * Approve: submitted -> queued. Operator-driven, so the app writes job.status
 * directly. This is one of the four transitions that are NOT the trigger's.
 *
 * Approval is also the first place the slicer estimate can be recorded. It is
 * optional here -- an operator approving a stack of requests before slicing any
 * of them should not be blocked -- but if it is skipped, startPrint requires it
 * before the job can reach a printer.
 *
 * When grams are known, successful grams already used are checked against the
 * owner's quota. Over quota WARNS but never BLOCKS -- the alternative is a
 * student's coursework stuck at 11pm with nobody to appeal to
 * (spec/02-workflows.md). The first call returns the warning; a second call
 * with override=true proceeds and logs who overrode what.
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

  const estimate = readEstimatePair(formData);
  if ("error" in estimate) return { error: estimate.error };

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

  // Jobs submitted before estimates moved to the operator already carry one;
  // whatever was just typed wins over it.
  const grams = "none" in estimate ? job.est_grams : estimate.grams;

  if (!override && grams !== null) {
    const warning = await quotaWarningFor(supabase, job.owner_id, grams);
    if (warning) return { error: null, quotaWarning: warning };
  }

  const { error } = await supabase
    .from("job")
    .update(
      "none" in estimate
        ? { status: "queued" }
        : {
            status: "queued",
            est_minutes: estimate.minutes,
            est_grams: estimate.grams,
          },
    )
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
 * Start a print. Inserting the attempt is the ONLY status work the app does
 * here -- the triggers move the job to printing and the printer to printing.
 *
 * This is the last point at which an estimate can be supplied, and the point at
 * which it stops being optional: grams decide which spool can cover the print,
 * minutes set attempt.expected_end, which is not null. If the job is still
 * unestimated and the form carries no numbers, nothing is written at all.
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
  const override = formData.get("override") === "true";

  if (typeof jobId !== "string") return { error: "Missing job id." };
  if (typeof printerId !== "string" || printerId === "") {
    return { error: "Pick a printer." };
  }
  if (typeof spoolId !== "string" || spoolId === "") {
    return { error: "Pick a spool." };
  }

  const estimate = readEstimatePair(formData);
  if ("error" in estimate) return { error: estimate.error };

  const supabase = await createClient();

  const { data: job, error: jobError } = await supabase
    .from("job")
    .select("est_minutes, est_grams, owner_id, status")
    .eq("id", jobId)
    .single();

  if (jobError) return { error: jobError.message };
  if (job.status !== "queued") {
    return { error: `This job is ${job.status}, not queued — reload the page.` };
  }

  // Numbers typed here win over anything already on the job: the operator is
  // looking at the slice right now.
  const typed = "none" in estimate ? null : estimate;
  const minutes = typed?.minutes ?? job.est_minutes;
  const grams = typed?.grams ?? job.est_grams;

  if (minutes === null || grams === null) {
    return {
      error:
        "This job has no estimate yet. Enter the slicer's minutes and grams before starting it.",
    };
  }

  // The quota gate fires once, where the estimate is first recorded. A job that
  // arrives here already estimated was checked at approval.
  if (!override && job.est_grams === null) {
    const warning = await quotaWarningFor(supabase, job.owner_id, grams);
    if (warning) return { error: null, quotaWarning: warning };
  }

  if (job.est_minutes !== minutes || job.est_grams !== grams) {
    const { error: estimateError } = await supabase
      .from("job")
      .update({ est_minutes: minutes, est_grams: grams })
      .eq("id", jobId)
      .eq("status", "queued");
    // Written before the attempt because guard_spool_sufficient reads it off
    // the job row, not off this insert.
    if (estimateError) return { error: estimateError.message };
  }

  const expectedEnd = new Date(Date.now() + minutes * 60_000).toISOString();

  const { error } = await supabase.from("attempt").insert({
    job_id: jobId,
    printer_id: printerId,
    spool_id: spoolId,
    started_by: staff.id,
    expected_end: expectedEnd,
  });

  if (error) return { error: humanizeAttemptError(error.message) };

  if (override) {
    // No override-log table in v1; the server log is the record. Build the
    // trigger point, log it, stop there -- same rule as notifications.
    console.warn(
      `[quota override] ${staff.full_name} (${staff.id}) started job ${jobId} over its owner's quota.`,
    );
  }

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
