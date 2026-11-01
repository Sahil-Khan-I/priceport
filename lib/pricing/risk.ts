/**
 * Booking risk summary from evidence — never claim payment was verified.
 */

import type { EligibilityStatus } from "./eligibility";

export type RiskLevel = "low" | "moderate" | "high" | "unknown";

export function assessBookingRisk(offer: any = {}) {
  const warnings: Array<{ code: string; message: string; evidence?: string }> =
    [];

  const eligibility = offer.eligibilityAssessment || {};
  const status = (eligibility.status || "not_checked") as EligibilityStatus;
  const trueCost = offer.trueCost || {};
  const propertyMatch = String(offer.propertyMatch || "unknown");

  if (!["exact", "probable"].includes(propertyMatch)) {
    warnings.push({
      code: "property_match",
      message: `Property match is ${propertyMatch} — offers may not be for the same hotel`,
      evidence: (offer.evidence || []).find((e: string) => /match/i.test(e)),
    });
  }

  if (trueCost.totalStatus && trueCost.totalStatus !== "confirmed") {
    warnings.push({
      code: "incomplete_total",
      message: `Total cost is ${trueCost.totalStatus}, not a confirmed all-in price`,
      evidence:
        Array.isArray(trueCost.unknownFees) && trueCost.unknownFees.length
          ? `Unknown fees: ${trueCost.unknownFees.join(", ")}`
          : undefined,
    });
  }

  if (Array.isArray(trueCost.unknownFees) && trueCost.unknownFees.length) {
    warnings.push({
      code: "unknown_fees",
      message: "Unknown fee components were reported and are not treated as zero",
      evidence: trueCost.unknownFees.join("; "),
    });
  }

  if (status === "restriction_detected") {
    warnings.push({
      code: "eligibility_restriction",
      message: "Restriction language was detected on the offer",
      evidence: (eligibility.restrictions || []).join(", "),
    });
  } else if (status === "eligibility_unclear" || status === "not_checked") {
    warnings.push({
      code: "eligibility_unverified",
      message:
        "Booking eligibility was not fully verified — a page scrape does not prove checkout will succeed",
    });
  }

  const cancelStatus = String(offer.cancellationStatus || "unknown");
  if (cancelStatus === "non_refundable") {
    warnings.push({
      code: "non_refundable",
      message: "Offer appears non-refundable",
      evidence: offer.cancellationPolicy || undefined,
    });
  } else if (cancelStatus === "unknown") {
    warnings.push({
      code: "cancellation_unknown",
      message: "Cancellation terms were not clearly established",
    });
  }

  if (offer.accessMethod === "storefront") {
    warnings.push({
      code: "storefront_access",
      message:
        "Market was investigated via regional storefront, not a local IP proxy",
      evidence: offer.storefrontRegion
        ? `Storefront region ${offer.storefrontRegion}`
        : undefined,
    });
  }

  if (!offer.sourceUrl) {
    warnings.push({
      code: "missing_source",
      message: "No source URL was captured for this offer",
    });
  }

  let level: RiskLevel = "unknown";
  if (warnings.length === 0) level = "low";
  else if (
    warnings.some((w) =>
      ["property_match", "eligibility_restriction", "missing_source"].includes(
        w.code,
      ),
    )
  ) {
    level = "high";
  } else if (warnings.length >= 3) level = "high";
  else if (warnings.length >= 1) level = "moderate";

  const summary =
    level === "low"
      ? "No major evidence-backed risks detected; payment success is still not guaranteed"
      : level === "moderate"
        ? "Some verification gaps or soft risks remain — review before booking"
        : level === "high"
          ? "Material risks or verification gaps — do not treat this as a safe book recommendation"
          : "Risk could not be assessed";

  return { level, summary, warnings };
}
