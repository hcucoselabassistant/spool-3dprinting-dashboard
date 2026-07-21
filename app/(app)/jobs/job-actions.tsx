"use client";

import { useActionState, useEffect, useState } from "react";

import { FormError, TextInput } from "@/components/form";
import { Modal } from "@/components/modal";
import type { ViableSpool } from "@/lib/queries/core";
import type { JobListItem } from "@/lib/queries/jobs";

import {
  approveJob,
  cancelJob,
  markCollected,
  markReady,
  type ActionState,
} from "./core-actions";
import { FinishModal } from "./finish-modal";
import { StartModal, type PrinterOption } from "./start-modal";

const INITIAL: ActionState = { error: null };

/**
 * The one primary action for a job, chosen by its status. This is a stand-in
 * for the floor view (Phase 5), which drives the same transitions from the
 * timeline and queue. The transitions themselves live in core-actions.ts.
 */
export function JobActions({
  job,
  printers,
  spools,
  liveAttemptId,
}: {
  job: JobListItem;
  printers: PrinterOption[];
  spools: ViableSpool[];
  liveAttemptId: string | null;
}) {
  const [modal, setModal] = useState<null | "start" | "finish" | "ready" | "cancel">(
    null,
  );

  return (
    <div className="flex items-center justify-end gap-2">
      {job.status === "submitted" ? (
        <InlineAction
          action={approveJob}
          jobId={job.id}
          label="Approve"
          primary
        />
      ) : null}

      {job.status === "queued" ? (
        <button
          onClick={() => setModal("start")}
          className="rounded-md bg-status-printing px-3 py-1.5 text-sm font-medium text-background"
        >
          Start print
        </button>
      ) : null}

      {job.status === "printing" && liveAttemptId ? (
        <button
          onClick={() => setModal("finish")}
          className="rounded-md bg-status-printing px-3 py-1.5 text-sm font-medium text-background"
        >
          Finish
        </button>
      ) : null}

      {job.status === "post_processing" ? (
        <button
          onClick={() => setModal("ready")}
          className="rounded-md bg-status-ready px-3 py-1.5 text-sm font-medium text-background"
        >
          Mark ready
        </button>
      ) : null}

      {job.status === "ready_for_pickup" ? (
        <InlineAction
          action={markCollected}
          jobId={job.id}
          label="Collected"
          primary
        />
      ) : null}

      {["submitted", "queued", "post_processing"].includes(job.status) ? (
        <button
          onClick={() => setModal("cancel")}
          className="rounded-md border border-border px-3 py-1.5 text-sm text-muted hover:text-status-failed"
        >
          Cancel
        </button>
      ) : null}

      {modal === "start" ? (
        <StartModal
          jobId={job.id}
          material={job.material}
          estGrams={job.est_grams}
          printers={printers}
          spools={spools}
          onClose={() => setModal(null)}
        />
      ) : null}

      {modal === "finish" && liveAttemptId ? (
        <FinishModal
          attemptId={liveAttemptId}
          estGrams={job.est_grams}
          onClose={() => setModal(null)}
        />
      ) : null}

      {modal === "ready" ? (
        <ShelfModal job={job} onClose={() => setModal(null)} />
      ) : null}

      {modal === "cancel" ? (
        <CancelModal job={job} onClose={() => setModal(null)} />
      ) : null}
    </div>
  );
}

/** A button that fires a server action needing only the job id. */
function InlineAction({
  action,
  jobId,
  label,
  primary,
}: {
  action: (prev: ActionState, form: FormData) => Promise<ActionState>;
  jobId: string;
  label: string;
  primary?: boolean;
}) {
  const [state, formAction] = useActionState(action, INITIAL);

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="job_id" value={jobId} />
      {state.error ? (
        <span className="text-xs text-status-failed">{state.error}</span>
      ) : null}
      <button
        type="submit"
        className={
          primary
            ? "rounded-md bg-status-printing px-3 py-1.5 text-sm font-medium text-background"
            : "rounded-md border border-border px-3 py-1.5 text-sm"
        }
      >
        {label}
      </button>
    </form>
  );
}

function ShelfModal({
  job,
  onClose,
}: {
  job: JobListItem;
  onClose: () => void;
}) {
  const [state, action] = useActionState(markReady, INITIAL);
  useEffect(() => {
    if (state.ok) onClose();
  }, [state.ok, onClose]);

  return (
    <Modal title="Ready for pickup" onClose={onClose}>
      <form action={action} className="flex flex-col gap-4">
        <input type="hidden" name="job_id" value={job.id} />
        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-muted">Shelf location</span>
          <TextInput
            name="shelf_location"
            placeholder="e.g. B-3"
            autoFocus
            required
          />
          <span className="text-xs text-muted">
            How {job.owner?.display_name ?? "the owner"} finds it on pickup.
          </span>
        </label>
        <FormError message={state.error} />
        <div className="flex justify-end">
          <button
            type="submit"
            className="rounded-md bg-status-ready px-4 py-2 text-sm font-medium text-background"
          >
            Mark ready
          </button>
        </div>
      </form>
    </Modal>
  );
}

function CancelModal({
  job,
  onClose,
}: {
  job: JobListItem;
  onClose: () => void;
}) {
  const [state, action] = useActionState(cancelJob, INITIAL);
  useEffect(() => {
    if (state.ok) onClose();
  }, [state.ok, onClose]);

  return (
    <Modal title={`Cancel “${job.title}”`} onClose={onClose}>
      <form action={action} className="flex flex-col gap-4">
        <input type="hidden" name="job_id" value={job.id} />
        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-muted">Reason</span>
          <TextInput
            name="reason"
            placeholder="Why is this being cancelled?"
            autoFocus
            required
          />
          <span className="text-xs text-muted">
            Recorded on the job. This is the only record of why.
          </span>
        </label>
        <FormError message={state.error} />
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border px-4 py-2 text-sm"
          >
            Keep job
          </button>
          <button
            type="submit"
            className="rounded-md border border-status-failed/40 px-4 py-2 text-sm text-status-failed hover:bg-status-failed/10"
          >
            Cancel job
          </button>
        </div>
      </form>
    </Modal>
  );
}
