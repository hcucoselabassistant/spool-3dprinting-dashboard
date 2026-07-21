import { TIMEZONE } from "@/lib/config";

// Grams, minutes, and cents are integers everywhere in the database. They become
// human units here and nowhere else.

export function formatGrams(grams: number): string {
  if (grams >= 1000) {
    return `${(grams / 1000).toFixed(2)} kg`;
  }
  return `${grams.toLocaleString("en-US")} g`;
}

export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/**
 * Cost per gram, resolved against the spool actually used. Fractions of a cent
 * matter here -- filament runs around 2-3 cents a gram, so rounding to whole
 * cents would collapse every spool to the same number.
 */
export function formatCostPerGram(
  costCents: number,
  totalGrams: number,
): string {
  if (totalGrams <= 0) return "—";
  return `${(costCents / totalGrams).toFixed(2)}¢/g`;
}

export function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}m`;
  if (rest === 0) return `${hours}h`;
  return `${hours}h ${rest}m`;
}

export function formatHours(hours: number): string {
  return `${Math.round(hours).toLocaleString("en-US")} h`;
}

export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    timeZone: TIMEZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    timeZone: TIMEZONE,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
