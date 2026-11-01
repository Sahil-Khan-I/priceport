/**
 * Price observation helpers — only compare real stored observations.
 * Never invent history.
 */

export type PriceObservation = {
  id: string;
  trackId?: string | null;
  investigationId?: string | null;
  hotelName: string;
  hotelLocation?: string | null;
  provider: string;
  market: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  rooms: number;
  roomType?: string | null;
  mealPlan?: string | null;
  cancellationPolicy?: string | null;
  displayedTotal: number | null;
  currency: string | null;
  totalStatus: string;
  propertyMatch?: string | null;
  sourceUrl?: string | null;
  tinyfishRunId?: string | null;
  checkedAt: string;
};

export type PriceMovement =
  | {
      available: true;
      direction: "drop" | "increase" | "unchanged";
      previous: number;
      current: number;
      delta: number;
      percent: number | null;
      currency: string;
      previousAt: string;
      currentAt: string;
      meaningful: boolean;
      note: string;
    }
  | {
      available: false;
      reason: string;
    };

/** Same stay + provider + market + room identity key for observation grouping. */
export function observationKey(o: Partial<PriceObservation>) {
  return [
    normalize(o.hotelName),
    normalize(o.provider),
    normalize(o.market),
    o.checkIn || "",
    o.checkOut || "",
    String(o.adults ?? ""),
    String(o.children ?? ""),
    String(o.rooms ?? ""),
    normalize(o.roomType),
  ].join("|");
}

export function detectPriceMovement(
  previous: PriceObservation | null | undefined,
  current: PriceObservation | null | undefined,
  { meaningfulPercent = 3 }: { meaningfulPercent?: number } = {},
): PriceMovement {
  if (!previous || !current) {
    return { available: false, reason: "Need at least two real observations" };
  }

  if (observationKey(previous) !== observationKey(current)) {
    return {
      available: false,
      reason:
        "Observations are not comparable (different hotel, stay, provider, market, or room)",
    };
  }

  if (previous.displayedTotal == null || current.displayedTotal == null) {
    return { available: false, reason: "One or both observations lack a price" };
  }

  if (
    previous.currency &&
    current.currency &&
    previous.currency !== current.currency
  ) {
    return {
      available: false,
      reason: `Currency changed (${previous.currency} → ${current.currency}); not compared`,
    };
  }

  const delta = round(current.displayedTotal - previous.displayedTotal);
  const percent =
    previous.displayedTotal !== 0
      ? round((delta / previous.displayedTotal) * 100)
      : null;
  const direction =
    delta < 0 ? "drop" : delta > 0 ? "increase" : "unchanged";
  const meaningful =
    direction !== "unchanged" &&
    (percent == null || Math.abs(percent) >= meaningfulPercent);

  return {
    available: true,
    direction,
    previous: previous.displayedTotal,
    current: current.displayedTotal,
    delta,
    percent,
    currency: current.currency || previous.currency || "",
    previousAt: previous.checkedAt,
    currentAt: current.checkedAt,
    meaningful,
    note:
      direction === "unchanged"
        ? "No price change between observations"
        : meaningful
          ? `Meaningful ${direction} of ${Math.abs(delta)} ${current.currency || ""}`.trim()
          : `Small ${direction} below ${meaningfulPercent}% threshold`,
  };
}

function normalize(value: unknown) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function round(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
