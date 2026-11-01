import { createEmptyOffer } from "@/lib/offers/schema";
import { matchProperty } from "@/lib/hotels/matching";
import { calculateTrueCost } from "@/lib/pricing/true-cost";

export function normalizeJobOffer({
  job,
  hotel,
  bookingDetails,
  runResult,
  tinyfishRunId,
  raw,
}) {
  const payload = unwrap(runResult);
  const match = matchProperty(hotel, payload || {});

  const basePrice = num(payload?.basePrice ?? payload?.base_price);
  const taxes = num(payload?.taxes);
  const mandatoryFees = num(
    payload?.mandatoryFees ?? payload?.mandatory_fees,
  );
  const estimatedFees = num(
    payload?.estimatedFees ?? payload?.estimated_fees,
  );
  const totalPrice = num(payload?.totalPrice ?? payload?.total_price ?? payload?.price);
  const unknownFees = Array.isArray(payload?.unknownFees)
    ? payload.unknownFees
    : Array.isArray(payload?.unknown_fees)
      ? payload.unknown_fees
      : [];

  const trueCost = calculateTrueCost({
    basePrice,
    taxes,
    mandatoryFees,
    estimatedFees,
    unknownFees,
    totalPrice,
    totalStatus: payload?.totalStatus || payload?.total_status,
  });

  const propertyMatch =
    payload?.propertyMatch || payload?.property_match || match.status;

  return createEmptyOffer({
    id: `${job.id}_offer`,
    provider: job.providerName || job.provider,
    providerUrl: job.url || "",
    hotelName: payload?.hotelName || payload?.property_or_product || hotel?.name || "",
    propertyAddress: payload?.propertyAddress || payload?.address || null,
    propertyMatch,
    market: job.market,
    actualProxyCountry: job.actualProxyCountry,
    storefrontRegion: job.storefrontRegion,
    accessMethod: job.accessMethod,
    accessVerified: Boolean(job.accessVerified),
    checkIn: bookingDetails.checkIn,
    checkOut: bookingDetails.checkOut,
    adults: bookingDetails.adults,
    children: bookingDetails.children,
    rooms: bookingDetails.rooms,
    roomType: payload?.roomType ?? payload?.room_type ?? null,
    mealPlan: payload?.mealPlan ?? payload?.meal_plan ?? null,
    cancellationPolicy:
      payload?.cancellationPolicy ??
      payload?.cancellation_policy ??
      payload?.cancellation_terms ??
      null,
    basePrice,
    currency: payload?.currency || "",
    taxes,
    mandatoryFees,
    estimatedFees,
    unknownFees,
    totalPrice: trueCost.displayedTotal,
    totalStatus: trueCost.totalStatus,
    availability: payload?.availability || "unknown",
    eligibility: Array.isArray(payload?.eligibility) ? payload.eligibility : [],
    sourceUrl: payload?.sourceUrl || payload?.source_url || job.url || "",
    checkedAt: new Date().toISOString(),
    evidence: [
      ...(Array.isArray(payload?.evidence) ? payload.evidence : []),
      ...match.reasons.map((r) => `Match: ${r}`),
    ],
    tinyfishRunId: tinyfishRunId || "",
    investigationStatus: job.status,
    raw,
  });
}

function unwrap(result) {
  if (!result) return null;
  if (typeof result === "object" && result.result !== undefined) {
    return typeof result.result === "object" ? result.result : { value: result.result };
  }
  return result;
}

function num(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/[^0-9.-]/g, "");
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}
