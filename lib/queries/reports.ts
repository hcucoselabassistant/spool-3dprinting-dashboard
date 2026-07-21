import { createClient } from "@/lib/supabase/server";
import { TIMEZONE } from "@/lib/config";

export type CostRow = {
  label: string;
  grams: number;
  cents: number;
};

export type MonthlyCost = {
  month: string; // YYYY-MM in the configured timezone
  totalGrams: number;
  totalCents: number;
  byOwner: CostRow[];
  byCourse: CostRow[];
};

export type ReliabilityRow = {
  printerName: string;
  attempts: number;
  failures: number;
  failureRatePct: number;
  wastedGrams: number;
};

/**
 * Monthly filament cost, grouped by owner and by course.
 *
 * owner_usage is lifetime-only, so this aggregates finalised attempts directly.
 * Cost per attempt is actual_grams * (spool cost / spool total) -- resolved
 * against the spool actually used, which stays correct even as spool prices
 * change between purchases. Failed attempts are included: their filament was
 * still spent and still costs the lab money.
 */
export async function getCostReport(): Promise<MonthlyCost[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("attempt")
    .select(
      "actual_grams, ended_at, spool(cost_cents, total_grams), job(owner(display_name, course_code))",
    )
    .not("ended_at", "is", null)
    .not("actual_grams", "is", null);

  if (error) throw error;

  // month -> owner/course -> {grams, cents}
  const months = new Map<
    string,
    { grams: number; cents: number; owners: Map<string, CostRow>; courses: Map<string, CostRow> }
  >();

  for (const row of data ?? []) {
    if (row.actual_grams == null || !row.ended_at || !row.spool) continue;

    const grams = row.actual_grams;
    const perGram =
      row.spool.total_grams > 0 ? row.spool.cost_cents / row.spool.total_grams : 0;
    const cents = Math.round(grams * perGram);

    const month = monthKey(row.ended_at);
    const ownerName = row.job?.owner?.display_name ?? "unknown";
    const course = row.job?.owner?.course_code ?? "— no course —";

    const bucket =
      months.get(month) ??
      { grams: 0, cents: 0, owners: new Map(), courses: new Map() };

    bucket.grams += grams;
    bucket.cents += cents;
    addTo(bucket.owners, ownerName, grams, cents);
    addTo(bucket.courses, course, grams, cents);
    months.set(month, bucket);
  }

  return [...months.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1)) // newest month first
    .map(([month, bucket]) => ({
      month,
      totalGrams: bucket.grams,
      totalCents: bucket.cents,
      byOwner: sortedRows(bucket.owners),
      byCourse: sortedRows(bucket.courses),
    }));
}

/** Reliability per printer, from the view. Empty printers sink to the bottom. */
export async function getReliability(): Promise<ReliabilityRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("printer_reliability")
    .select("*");
  if (error) throw error;

  return (data ?? [])
    .map((row) => ({
      printerName: row.name ?? "?",
      attempts: row.attempts ?? 0,
      failures: row.failures ?? 0,
      failureRatePct: row.failure_rate_pct ?? 0,
      wastedGrams: row.wasted_grams ?? 0,
    }))
    .sort((a, b) => {
      if (a.attempts === 0 && b.attempts > 0) return 1;
      if (b.attempts === 0 && a.attempts > 0) return -1;
      return b.failureRatePct - a.failureRatePct;
    });
}

function addTo(map: Map<string, CostRow>, label: string, grams: number, cents: number) {
  const existing = map.get(label);
  if (existing) {
    existing.grams += grams;
    existing.cents += cents;
  } else {
    map.set(label, { label, grams, cents });
  }
}

function sortedRows(map: Map<string, CostRow>): CostRow[] {
  return [...map.values()].sort((a, b) => b.cents - a.cents);
}

function monthKey(iso: string): string {
  // en-CA renders YYYY-MM-DD; take the year-month in the lab's timezone so a
  // late-night print lands in the right budget month.
  return new Date(iso)
    .toLocaleDateString("en-CA", {
      timeZone: TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
    .slice(0, 7);
}
