import Link from "next/link";
import { notFound } from "next/navigation";

import { StatusPill } from "@/components/status-pill";
import { requireStaff } from "@/lib/auth";
import {
  formatDate,
  formatDateTime,
  formatGrams,
  formatMinutes,
} from "@/lib/format";
import { getJobDetail, getJobFileUrl } from "@/lib/queries/job-detail";
import type { AttemptHistoryItem } from "@/lib/queries/job-detail";

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireStaff();
  const { id } = await params;

  const detail = await getJobDetail(id);
  if (!detail) notFound();

  const { job, ownerName, submittedByName, attempts } = detail;
  const fileUrl = job.file_path ? await getJobFileUrl(job.file_path) : null;

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/jobs" className="text-sm text-muted hover:text-foreground">
        ← All jobs
      </Link>

      <div className="mt-3 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{job.title}</h1>
          <p className="mt-1 text-muted">
            {ownerName} · submitted by {submittedByName}
          </p>
        </div>
        <StatusPill status={job.status} />
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-4 rounded-lg border border-border bg-surface p-4 text-sm sm:grid-cols-4">
        <Fact label="Material" value={job.material} />
        <Fact label="Estimate" value={`${formatMinutes(job.est_minutes)} · ${formatGrams(job.est_grams)}`} />
        <Fact label="Needed by" value={job.needed_by ? formatDate(job.needed_by) : "—"} />
        <Fact label="Priority" value={String(job.priority)} />
        {job.color_preference ? (
          <Fact label="Colour preference" value={job.color_preference} />
        ) : null}
        {job.shelf_location ? (
          <Fact label="Shelf" value={job.shelf_location} />
        ) : null}
      </dl>

      {job.notes ? (
        <div className="mt-4 rounded-lg border border-border bg-surface p-4">
          <p className="text-xs uppercase tracking-wide text-muted">Notes</p>
          <p className="mt-1 whitespace-pre-wrap text-sm">{job.notes}</p>
        </div>
      ) : null}

      {job.file_path ? (
        <div className="mt-4">
          {fileUrl ? (
            <a
              href={fileUrl}
              className="inline-flex rounded-md border border-border px-3 py-2 text-sm hover:bg-surface-raised"
            >
              Download file
            </a>
          ) : (
            <p className="text-sm text-muted">
              A file is attached but the link could not be generated.
            </p>
          )}
        </div>
      ) : null}

      <section className="mt-8">
        <h2 className="mb-1 text-lg font-semibold">Attempt history</h2>
        <p className="mb-4 text-sm text-muted">
          Every run of this job. This is the record — a failed attempt is kept,
          never overwritten by a re-run.
        </p>

        {attempts.length === 0 ? (
          <p className="rounded-lg border border-border bg-surface p-6 text-center text-sm text-muted">
            No attempts yet. This job has not been started.
          </p>
        ) : (
          <ol className="flex flex-col gap-3">
            {attempts.map((attempt, index) => (
              <AttemptRow
                key={attempt.id}
                attempt={attempt}
                index={attempts.length - index}
              />
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-0.5">{value}</dd>
    </div>
  );
}

function AttemptRow({
  attempt,
  index,
}: {
  attempt: AttemptHistoryItem;
  index: number;
}) {
  const live = attempt.endedAt === null;
  const durationMin = attempt.endedAt
    ? Math.round(
        (new Date(attempt.endedAt).getTime() -
          new Date(attempt.startedAt).getTime()) /
          60_000,
      )
    : null;

  const outcomeTone =
    attempt.outcome === "success"
      ? "text-status-ready"
      : attempt.outcome === "failed"
        ? "text-status-failed"
        : attempt.outcome === "cancelled"
          ? "text-muted"
          : "text-status-printing";

  return (
    <li className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium">
          Attempt {index} · {attempt.printerName}
        </span>
        <span className={`text-sm font-medium ${outcomeTone}`}>
          {live ? "running" : (attempt.outcome ?? "—")}
          {attempt.failureReason ? ` · ${attempt.failureReason.replace(/_/g, " ")}` : ""}
        </span>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-muted sm:grid-cols-4">
        <span>{attempt.spoolLabel}</span>
        <span>
          {live
            ? `started ${formatDateTime(attempt.startedAt)}`
            : durationMin !== null
              ? formatMinutes(durationMin)
              : "—"}
        </span>
        <span>
          {attempt.actualGrams !== null
            ? `${formatGrams(attempt.actualGrams)} used`
            : "—"}
        </span>
        <span>{attempt.operatorName}</span>
      </div>

      {attempt.notes ? (
        <p className="mt-2 whitespace-pre-wrap text-sm">{attempt.notes}</p>
      ) : null}
    </li>
  );
}
