import { createEmptyOffer } from "@/lib/offers/schema";
import {
  matchProperty,
  compareBookingDetails,
  classifyRoomMatch,
  classifyMealPlan,
  classifyCancellation,
} from "@/lib/hotels/matching";
import { calculateTrueCost } from "@/lib/pricing/true-cost";
import { assessEligibility } from "@/lib/pricing/eligibility";
import { assessBookingRisk } from "@/lib/pricing/risk";
import { classifyOffer } from "@/lib/offers/validate";

export function normalizeJobOffer({
  job,
  hotel,
  bookingDetails,
  runResult,
  tinyfishRunId,
  raw,
  homeCountry = null,
}: {
  job: any;
  hotel: any;
  bookingDetails: any;
  runResult: any;
  tinyfishRunId?: string | null;
  raw?: unknown;
  homeCountry?: string | null;
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
  const optionalFees = num(
    payload?.optionalFees ?? payload?.optional_fees,
  );
  const totalPrice = num(
    payload?.totalPrice ?? payload?.total_price ?? payload?.price,
  );
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

  const roomType = payload?.roomType ?? payload?.room_type ?? null;
  const mealPlan = payload?.mealPlan ?? payload?.meal_plan ?? null;
  const cancellationPolicy =
    payload?.cancellationPolicy ??
    payload?.cancellation_policy ??
    payload?.cancellation_terms ??
    null;
  const refundable =
    typeof payload?.refundable === "boolean" ? payload.refundable : null;

  const roomMatch = classifyRoomMatch(null, roomType).status;
  const mealPlanStatus = classifyMealPlan(mealPlan);
  const cancellationStatus = classifyCancellation(
    cancellationPolicy,
    refundable,
  );

  const bookingCompare = compareBookingDetails(bookingDetails, {
    checkIn: payload?.checkInExtracted ?? payload?.checkIn,
    checkOut: payload?.checkOutExtracted ?? payload?.checkOut,
    adults: payload?.adultsExtracted ?? payload?.adults,
    children: payload?.childrenExtracted ?? payload?.children,
    rooms: payload?.roomsExtracted ?? payload?.rooms,
  });

  const missingFields: string[] = [];
  if (basePrice == null) missingFields.push("basePrice");
  if (taxes == null) missingFields.push("taxes");
  if (mandatoryFees == null) missingFields.push("mandatoryFees");
  if (!payload?.currency) missingFields.push("currency");
  if (!roomType) missingFields.push("roomType");
  if (!mealPlan) missingFields.push("mealPlan");
  if (!cancellationPolicy && refundable == null) {
    missingFields.push("cancellationPolicy");
  }
  if (!(payload?.sourceUrl || payload?.source_url || job.url)) {
    missingFields.push("sourceUrl");
  }

  const offerDraft = createEmptyOffer({
    id: `${job.id}_offer`,
    provider: job.providerName || job.provider,
    providerUrl: job.url || "",
    hotelName:
      payload?.hotelName || payload?.property_or_product || hotel?.name || "",
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
    roomType,
    bedConfiguration:
      payload?.bedConfiguration ?? payload?.bed_configuration ?? null,
    mealPlan,
    cancellationPolicy,
    refundable,
    freeCancellationUntil:
      payload?.freeCancellationUntil ??
      payload?.free_cancellation_until ??
      null,
    prepayment: payload?.prepayment ?? null,
    roomMatch,
    mealPlanStatus,
    cancellationStatus,
    basePrice,
    currency: payload?.currency || "",
    taxes,
    mandatoryFees,
    estimatedFees,
    optionalFees,
    unknownFees,
    totalPrice: trueCost.displayedTotal,
    totalStatus: trueCost.totalStatus,
    availability: payload?.availability || "unknown",
    eligibility: Array.isArray(payload?.eligibility) ? payload.eligibility : [],
    sourceUrl: payload?.sourceUrl || payload?.source_url || job.url || "",
    checkedAt: new Date().toISOString(),
    evidence: [
      ...(Array.isArray(payload?.evidence) ? payload.evidence : []),
      ...match.reasons.map((r: string) => `Match: ${r}`),
      ...bookingCompare.differences.map((d: string) => `Stay: ${d}`),
      ...bookingCompare.unknowns.map((u: string) => `Stay: ${u}`),
    ],
    missingFields,
    tinyfishRunId: tinyfishRunId || "",
    investigationStatus: job.status,
    trueCost,
    raw,
  });

  const eligibilityAssessment = assessEligibility(offerDraft, { homeCountry });
  offerDraft.eligibilityAssessment = eligibilityAssessment;

  const classification = classifyOffer(offerDraft, {
    provider: offerDraft.provider,
    tinyfishRunId: offerDraft.tinyfishRunId,
  });
  offerDraft.verificationStatus =
    classification.result === "PASS"
      ? "verified"
      : classification.result === "PARTIAL"
        ? "partially_verified"
        : classification.result === "FAIL"
          ? "failed_to_verify"
          : "unknown";

  offerDraft.bookingRisk = assessBookingRisk(offerDraft);

  return offerDraft;
}

function unwrap(result: any) {
  if (!result) return null;
  if (typeof result === "object" && result.result !== undefined) {
    return typeof result.result === "object"
      ? result.result
      : { value: result.result };
  }
  return result;
}

function num(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/[^0-9.-]/g, "");
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}
