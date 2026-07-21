import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

export type Job = Database["public"]["Tables"]["job"]["Row"];
export type JobStatus = Database["public"]["Enums"]["job_status"];

export type JobListItem = Job & {
  owner: { id: string; display_name: string } | null;
};

/**
 * Recent jobs, newest first.
 *
 * Phase 6 replaces this with the filterable list from spec/03-screens.md. It
 * exists now so a submitted job is visible somewhere.
 */
export async function getRecentJobs(limit = 50): Promise<JobListItem[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("job")
    .select("*, owner(id, display_name)")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}
