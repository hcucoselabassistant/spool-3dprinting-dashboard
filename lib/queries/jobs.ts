import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

export type Job = Database["public"]["Tables"]["job"]["Row"];
export type JobStatus = Database["public"]["Enums"]["job_status"];

export type JobListItem = Job & {
  owner: { id: string; display_name: string } | null;
};

export type JobFilters = {
  status?: JobStatus;
  ownerId?: string;
  printerId?: string;
};

/**
 * Jobs, newest first, filterable by status, owner, and printer.
 *
 * A job has no printer column -- printers live on attempts -- so the printer
 * filter resolves to the set of jobs that have an attempt on that machine, then
 * narrows the job query to those ids.
 */
export async function getJobs(
  filters: JobFilters = {},
  limit = 100,
): Promise<JobListItem[]> {
  const supabase = await createClient();

  let printerJobIds: string[] | null = null;
  if (filters.printerId) {
    const { data, error } = await supabase
      .from("attempt")
      .select("job_id")
      .eq("printer_id", filters.printerId);
    if (error) throw error;
    printerJobIds = [...new Set((data ?? []).map((row) => row.job_id))];
    if (printerJobIds.length === 0) return [];
  }

  let query = supabase
    .from("job")
    .select("*, owner(id, display_name)")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (filters.status) query = query.eq("status", filters.status);
  if (filters.ownerId) query = query.eq("owner_id", filters.ownerId);
  if (printerJobIds) query = query.in("id", printerJobIds);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

/** All non-retired printers, for filter and picker dropdowns. */
export async function getPrinterOptions(): Promise<
  { id: string; name: string }[]
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("printer")
    .select("id, name")
    .neq("state", "retired")
    .order("name");
  if (error) throw error;
  return data ?? [];
}
