// Operational thresholds. Tunable per deployment without a code change, but
// with defaults that match how the lab actually runs today.

function readInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** Spools at or below this are surfaced as needing replacement. */
export const LOW_SPOOL_GRAMS = readInt(
  process.env.NEXT_PUBLIC_LOW_SPOOL_GRAMS,
  150,
);

/** Uncollected prints older than this show up on the floor view. */
export const PICKUP_STALE_HOURS = readInt(
  process.env.NEXT_PUBLIC_PICKUP_STALE_HOURS,
  48,
);

/** Everything is stored UTC and rendered here. */
export const TIMEZONE = process.env.NEXT_PUBLIC_TIMEZONE ?? "America/Chicago";
