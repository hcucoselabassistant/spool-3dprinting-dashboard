"use client";

import { useRouter, useSearchParams } from "next/navigation";

import { Select } from "@/components/form";
import type { Database } from "@/lib/database.types";

type JobStatus = Database["public"]["Enums"]["job_status"];

const STATUSES: JobStatus[] = [
  "submitted",
  "queued",
  "printing",
  "post_processing",
  "ready_for_pickup",
  "collected",
  "cancelled",
];

/**
 * Filters live in the URL so a filtered view is linkable and survives the
 * realtime refresh. Changing one replaces the query string; the server
 * component re-reads it.
 */
export function JobFilters({
  owners,
  printers,
}: {
  owners: { id: string; display_name: string }[];
  printers: { id: string; name: string }[];
}) {
  const router = useRouter();
  const params = useSearchParams();

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value === "") next.delete(key);
    else next.set(key, value);
    router.push(`/jobs?${next.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={params.get("status") ?? ""}
        onChange={(e) => setParam("status", e.target.value)}
        aria-label="Filter by status"
        className="text-sm"
      >
        <option value="">All statuses</option>
        {STATUSES.map((status) => (
          <option key={status} value={status}>
            {status.replace(/_/g, " ")}
          </option>
        ))}
      </Select>

      <Select
        value={params.get("owner") ?? ""}
        onChange={(e) => setParam("owner", e.target.value)}
        aria-label="Filter by owner"
        className="text-sm"
      >
        <option value="">All owners</option>
        {owners.map((owner) => (
          <option key={owner.id} value={owner.id}>
            {owner.display_name}
          </option>
        ))}
      </Select>

      <Select
        value={params.get("printer") ?? ""}
        onChange={(e) => setParam("printer", e.target.value)}
        aria-label="Filter by printer"
        className="text-sm"
      >
        <option value="">All printers</option>
        {printers.map((printer) => (
          <option key={printer.id} value={printer.id}>
            {printer.name}
          </option>
        ))}
      </Select>

      {params.toString() ? (
        <button
          onClick={() => router.push("/jobs")}
          className="text-sm text-muted hover:text-foreground"
        >
          Clear
        </button>
      ) : null}
    </div>
  );
}
