/**
 * Separate a displayed figure from a stay total.
 * A nightly amount is never promoted to a confirmed all-in total.
 */

export const PRICE_BASIS = [
  "per_night",
  "per_room_per_night",
  "total_stay",
  "per_person",
  "unknown",
] as const;

export type InterpretedPrice = {
  priceBasis: string;
  nightlyPrice: number | null;
  stayTotal: number | null;
  estimatedStayTotal: number | null;
  displayedUnscoped: number | null;
  note: string | null;
};

export function normalizePriceBasis(value: unknown) {
  const text = String(value || "")
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (["per_night", "nightly", "pernight"].includes(text)) return "per_night";
  if (["per_room_per_night", "per_room_night", "room_per_night"].includes(text)) {
    return "per_room_per_night";
  }
  if (["total_stay", "total", "stay_total", "per_stay"].includes(text)) return "total_stay";
  if (["per_person", "per_guest"].includes(text)) return "per_person";
  return "unknown";
}

export function interpretPrice({
  priceBasis,
  nightlyPrice = null,
  totalPrice = null,
  nights = null,
  rooms = 1,
}: {
  priceBasis?: unknown;
  nightlyPrice?: number | null;
  totalPrice?: number | null;
  nights?: number | null;
  rooms?: number | null;
}): InterpretedPrice {
  const basis = normalizePriceBasis(priceBasis);
  const nightly = money(nightlyPrice);
  const total = money(totalPrice);
  const nightCount = money(nights);
  const roomCount = Math.max(1, money(rooms) || 1);

  if (basis === "per_night" || basis === "per_room_per_night") {
    const rate = nightly ?? total;
    const multiplier = basis === "per_room_per_night" ? roomCount : 1;
    const estimate =
      rate != null && nightCount != null
        ? round(rate * nightCount * multiplier)
        : null;
    return {
      priceBasis: basis,
      nightlyPrice: rate,
      stayTotal: null,
      estimatedStayTotal: estimate,
      displayedUnscoped: null,
      note: "Displayed price is nightly and is not a confirmed stay total.",
    };
  }

  if (basis === "per_person") {
    return {
      priceBasis: basis,
      nightlyPrice: nightly,
      stayTotal: null,
      estimatedStayTotal: null,
      displayedUnscoped: total ?? nightly,
      note: "Per-person price is not a stay total.",
    };
  }

  if (basis === "total_stay") {
    return {
      priceBasis: basis,
      nightlyPrice: nightly,
      stayTotal: total,
      estimatedStayTotal: null,
      displayedUnscoped: null,
      note: null,
    };
  }

  return {
    priceBasis: "unknown",
    nightlyPrice: nightly,
    stayTotal: null,
    estimatedStayTotal: null,
    displayedUnscoped: total ?? nightly,
    note: "Price basis was not reported, so this amount is not treated as a confirmed stay total.",
  };
}

function money(value: unknown): number | null {
  if (value == null || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function round(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
