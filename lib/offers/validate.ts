/**
 * Classify extracted offers for live validation reports.
 * PASS = verified comparable; PARTIAL = genuine but incomplete; FAIL = invalid.
 */

import { calculateTrueCost } from "@/lib/pricing/true-cost";

export function classifyOffer(offer: any, context: any = {}) {
  if (!offer) {
    return {
      result: "FAIL",
      reasons: ["No offer extracted"],
    };
  }

  const reasons: string[] = [];
  const trueCost = calculateTrueCost(offer);

  if (!offer.provider && !context.provider) {
    reasons.push("Missing provider");
  }
  if (!offer.hotelName) reasons.push("Missing hotel name");
  if (!offer.currency) reasons.push("Missing currency");
  if (!offer.sourceUrl) reasons.push("Missing source URL");
  if (!offer.tinyfishRunId && !context.tinyfishRunId) {
    reasons.push("Missing TinyFish run ID");
  }
  if (!offer.checkedAt) reasons.push("Missing extraction timestamp");

  if (["unmatched"].includes(offer.propertyMatch)) {
    return {
      result: "FAIL",
      reasons: ["Property unmatched", ...reasons],
      trueCost,
    };
  }

  if (
    offer.totalPrice == null &&
    offer.basePrice == null &&
    offer.availability !== "unavailable"
  ) {
    return {
      result: "FAIL",
      reasons: ["No meaningful price extracted", ...reasons],
      trueCost,
    };
  }

  if (reasons.length > 0 && !offer.sourceUrl) {
    return { result: "FAIL", reasons, trueCost };
  }

  if (
    trueCost.fullyComparable &&
    ["exact", "probable"].includes(offer.propertyMatch) &&
    offer.sourceUrl &&
    offer.currency
  ) {
    return {
      result: "PASS",
      reasons: ["Verified comparable price with established mandatory charges"],
      trueCost,
    };
  }

  return {
    result: "PARTIAL",
    reasons: [
      trueCost.totalStatus !== "confirmed"
        ? `Total status is ${trueCost.totalStatus}`
        : "Offer incomplete",
      ...reasons,
      ...(trueCost.unknownFees || []).map((f: unknown) => `Unknown fee: ${f}`),
    ],
    trueCost,
  };
}
