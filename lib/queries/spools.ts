import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

export type Spool = Database["public"]["Tables"]["spool"]["Row"];

export type SpoolGroup = {
  material: string;
  spools: Spool[];
};

/**
 * Inventory, grouped by material then colour.
 *
 * Retired spools are excluded by default rather than deleted -- historical
 * attempts reference them, and the cost of a past print is resolved against the
 * spool it actually used.
 */
export async function getSpools(
  includeRetired = false,
): Promise<SpoolGroup[]> {
  const supabase = await createClient();

  let query = supabase
    .from("spool")
    .select("*")
    .order("material")
    .order("color_name")
    .order("remaining_grams");

  if (!includeRetired) {
    query = query.eq("retired", false);
  }

  const { data, error } = await query;
  if (error) throw error;

  const groups = new Map<string, Spool[]>();
  for (const spool of data ?? []) {
    const existing = groups.get(spool.material);
    if (existing) {
      existing.push(spool);
    } else {
      groups.set(spool.material, [spool]);
    }
  }

  return [...groups.entries()].map(([material, spools]) => ({
    material,
    spools,
  }));
}
