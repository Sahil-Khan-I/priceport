/**
 * Savings engine.
 * Savings are only computed across offers that are genuinely comparable:
 * same property confidence, confirmed all-in total, converted with a real FX source,
 * and the same room / meal plan / cancellation bucket.
 * No fabricated numbers: when a comparison is not valid, no figure is returned.
 */

export type SavingsOffer = {
  id: string;
  provider?: string;
  market?: string;
  roomType?: string | null;
  mealPlanStatus?: string | null;
  cancellationStatus?: string | null;
  propertyMatch?: string | null;
  comparable?: boolean;
  trueCost?: { fullyComparable?: boolean; confirmedTotal?: number | null } | null;
  conversion?: {
    available?: boolean;
    amount?: number | null;
    currency?: string | null;
    source?: string | null;
    fetchedAt?: string | null;
  } | null;
};

export type SavingsGroup = {
  key: string;
  label: string;
  offerIds: string[];
  lowestId: string;
  highestId: string;
  lowest: number;
  highest: number;
  savings: number;
  percent: number;
};

export type SavingsSummary = {
  currency: string;
  nights: number | null;
  headline: SavingsGroup | null;
  groups: SavingsGroup[];
  reason: string | null;
  basis: string;
  fxSource: string | null;
};

const UNKNOWN = new Set(["", "unknown", "not_checked", "undefined", "null"]);

export function stayNights(checkIn?: string | null, checkOut?: string | null) {
  if (!checkIn || !checkOut) return null;
  const a = Date.parse(`${checkIn}T00:00:00Z`);
  const b = Date.parse(`${checkOut}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return null;
  return Math.round((b - a) / 86_400_000);
}

export function perNight(total: number | null | undefined, nights: number | null) {
  if (total == null || !nights || nights < 1) return null;
  return Math.round((total / nights + Number.EPSILON) * 100) / 100;
}

export function comparisonKey(offer: SavingsOffer): string | null {
  const room = normalize(offer.roomType);
  const meal = normalize(offer.mealPlanStatus);
  const cancel = normalize(offer.cancellationStatus);
  if (UNKNOWN.has(room) || UNKNOWN.has(meal) || UNKNOWN.has(cancel)) return null;
  return `${room}|${meal}|${cancel}`;
}

export function calculateSavings(
  offers: SavingsOffer[] = [],
  {
    currency = "USD",
    checkIn = null,
    checkOut = null,
  }: { currency?: string; checkIn?: string | null; checkOut?: string | null } = {},
): SavingsSummary {
  const nights = stayNights(checkIn, checkOut);
  const basis =
    "Savings = highest comparable total − lowest comparable total, using confirmed all-in totals for the same room, meal plan and cancellation terms.";

  const eligible = offers.filter(
    (offer) =>
      offer.comparable === true &&
      offer.trueCost?.fullyComparable === true &&
      offer.conversion?.available === true &&
      typeof offer.conversion.amount === "number" &&
      Number.isFinite(offer.conversion.amount) &&
      ["exact", "probable"].includes(String(offer.propertyMatch || "")),
  );

  const buckets = new Map<string, SavingsOffer[]>();
  for (const offer of eligible) {
    const key = comparisonKey(offer);
    if (!key) continue;
    const list = buckets.get(key) || [];
    list.push(offer);
    buckets.set(key, list);
  }

  const groups: SavingsGroup[] = [];
  for (const [key, list] of buckets) {
    if (list.length < 2) continue;
    const sorted = [...list].sort(
      (a, b) => Number(a.conversion?.amount) - Number(b.conversion?.amount),
    );
    const low = sorted[0];
    const high = sorted[sorted.length - 1];
    const lowest = Number(low.conversion?.amount);
    const highest = Number(high.conversion?.amount);
    if (!(highest > 0)) continue;
    const savings = round2(highest - lowest);
    groups.push({
      key,
      label: groupLabel(low),
      offerIds: sorted.map((o) => o.id),
      lowestId: low.id,
      highestId: high.id,
      lowest,
      highest,
      savings,
      percent: round1((savings / highest) * 100),
    });
  }

  groups.sort((a, b) => b.savings - a.savings);
  const headline = groups.find((group) => group.savings > 0) || null;
  const fxSource =
    eligible.find((offer) => offer.conversion?.source)?.conversion?.source || null;

  return {
    currency,
    nights,
    headline,
    groups,
    reason: headline
      ? null
      : "Not enough comparable offers to calculate reliable savings.",
    basis,
    fxSource,
  };
}

function groupLabel(offer: SavingsOffer) {
  return [offer.roomType, offer.mealPlanStatus, offer.cancellationStatus]
    .filter(Boolean)
    .map((part) => String(part).replace(/_/g, " "))
    .join(" · ");
}

function normalize(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function round1(value: number) {
  return Math.round((value + Number.EPSILON) * 10) / 10;
}
