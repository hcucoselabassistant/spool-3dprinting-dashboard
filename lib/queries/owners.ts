import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

export type Owner = Database["public"]["Tables"]["owner"]["Row"];
export type OwnerKind = Database["public"]["Enums"]["owner_kind"];

export type OwnerWithUsage = Owner & {
  /** Grams from successful attempts. Quota is measured against this. */
  gramsSuccess: number;
  /** Grams burned on failures, kept separate -- see spec/01-data-model.md. */
  gramsFailed: number;
  costCents: number;
  activeJobs: number;
};

/**
 * Owners with their usage.
 *
 * grams_success and grams_failed stay separate all the way to the UI. Whether a
 * mechanical failure counts against a student's quota is a policy decision, and
 * collapsing them here would quietly make it for everyone.
 */
export async function getOwners(
  includeInactive = false,
): Promise<OwnerWithUsage[]> {
  const supabase = await createClient();

  let ownerQuery = supabase.from("owner").select("*").order("display_name");
  if (!includeInactive) {
    ownerQuery = ownerQuery.eq("active", true);
  }

  const [owners, usage, jobs] = await Promise.all([
    ownerQuery,
    supabase.from("owner_usage").select("*"),
    supabase
      .from("job")
      .select("owner_id")
      .not("status", "in", "(collected,cancelled)"),
  ]);

  if (owners.error) throw owners.error;
  if (usage.error) throw usage.error;
  if (jobs.error) throw jobs.error;

  const usageByOwner = new Map(
    (usage.data ?? []).flatMap((row) =>
      row.owner_id ? [[row.owner_id, row] as const] : [],
    ),
  );

  const activeByOwner = new Map<string, number>();
  for (const job of jobs.data ?? []) {
    activeByOwner.set(job.owner_id, (activeByOwner.get(job.owner_id) ?? 0) + 1);
  }

  return (owners.data ?? []).map((owner) => ({
    ...owner,
    gramsSuccess: usageByOwner.get(owner.id)?.grams_success ?? 0,
    gramsFailed: usageByOwner.get(owner.id)?.grams_failed ?? 0,
    costCents: usageByOwner.get(owner.id)?.cost_cents ?? 0,
    activeJobs: activeByOwner.get(owner.id) ?? 0,
  }));
}

/** Lightweight list for the job form's owner picker. */
export async function getOwnerOptions(): Promise<
  Pick<Owner, "id" | "display_name" | "kind" | "course_code">[]
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("owner")
    .select("id, display_name, kind, course_code")
    .eq("active", true)
    .order("display_name");

  if (error) throw error;
  return data ?? [];
}
