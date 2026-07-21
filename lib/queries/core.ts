import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

type Spool = Database["public"]["Tables"]["spool"]["Row"];
type Printer = Database["public"]["Tables"]["printer"]["Row"];

/** Printers that can take a job right now. */
export async function getAvailablePrinters(): Promise<
  Pick<Printer, "id" | "name" | "model">[]
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("printer")
    .select("id, name, model")
    .eq("state", "available")
    .order("name");

  if (error) throw error;
  return data ?? [];
}

/**
 * Spools that can cover this job, best first.
 *
 * Ordered by least remaining that still covers est_grams, so a start burns down
 * a partial spool before opening a fresh one -- spec/02-workflows.md. The
 * material match is exact; a PETG job is never offered a PLA spool.
 */
export async function getSpoolSuggestions(
  material: string,
  estGrams: number,
): Promise<Pick<Spool, "id" | "color_name" | "brand" | "remaining_grams" | "total_grams" | "cost_cents">[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("spool")
    .select("id, color_name, brand, remaining_grams, total_grams, cost_cents")
    .eq("material", material)
    .eq("retired", false)
    .gte("remaining_grams", estGrams)
    .order("remaining_grams", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export type ViableSpool = Pick<
  Spool,
  "id" | "material" | "color_name" | "brand" | "remaining_grams" | "total_grams" | "cost_cents"
>;

/**
 * Every spool that could back a print: not retired, something left on it.
 * Sent to the jobs list once and filtered per job in the browser, rather than a
 * suggestion query per row. There are not many spools.
 */
export async function getViableSpools(): Promise<ViableSpool[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("spool")
    .select(
      "id, material, color_name, brand, remaining_grams, total_grams, cost_cents",
    )
    .eq("retired", false)
    .gt("remaining_grams", 0)
    .order("remaining_grams", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

/** job_id -> live attempt id, for every job currently printing. */
export async function getLiveAttemptsByJob(): Promise<Map<string, string>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("attempt")
    .select("id, job_id")
    .is("ended_at", null);

  if (error) throw error;
  return new Map((data ?? []).map((row) => [row.job_id, row.id]));
}

/**
 * The live attempt on a job, if it is printing. "Live" means not finalised:
 * ended_at is null. There is at most one, guaranteed by
 * attempt_one_live_per_printer.
 */
export async function getLiveAttempt(jobId: string): Promise<{
  id: string;
  printer_id: string;
  spool_id: string;
  expected_end: string;
  started_at: string;
} | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("attempt")
    .select("id, printer_id, spool_id, expected_end, started_at")
    .eq("job_id", jobId)
    .is("ended_at", null)
    .maybeSingle();

  if (error) throw error;
  return data;
}
