import { calculateTrueCost } from "./true-cost";
import { convertAmount } from "./currency";
import { compareRoomConditions } from "@/lib/hotels/matching";
import { assessEligibility } from "./eligibility";
import { assessBookingRisk } from "./risk";

/**
 * Rank offers with evidence-backed comparability and a decision summary.
 */
export async function rankOffers(
  offers: any[] = [],
  preferredCurrency = "USD",
  context: { homeCountry?: string | null } = {},
) {
  // Currency lookups are independent. Resolve them concurrently so the final
  // ranking does not wait for one network-backed FX conversion at a time.
  const enriched: any[] = await Promise.all(
    offers.map(async (offer) => {
      const trueCost = calculateTrueCost(offer);
      const conversion =
        trueCost.displayedTotal != null && offer.currency
          ? await convertAmount(
              trueCost.displayedTotal,
              offer.currency,
              preferredCurrency,
            )
          : { available: false, reason: "No total to convert" };

      const eligibilityAssessment =
        offer.eligibilityAssessment ||
        assessEligibility({ ...offer, trueCost }, context);

      const withAssessments = {
        ...offer,
        trueCost,
        conversion,
        eligibilityAssessment,
      };
      const bookingRisk =
        offer.bookingRisk?.warnings?.length
          ? offer.bookingRisk
          : assessBookingRisk(withAssessments);

      const bookable =
        offer.availability === "available" &&
        ["exact", "probable"].includes(offer.propertyMatch) &&
        eligibilityAssessment.status !== "restriction_detected" &&
        eligibilityAssessment.bookable !== false;

      return {
        ...withAssessments,
        bookingRisk,
        bookable,
        comparable:
          trueCost.fullyComparable &&
          conversion.available &&
          ["exact", "probable"].includes(offer.propertyMatch) &&
          ["exact_match", "comparable"].includes(offer.comparisonClass || "comparable") &&
          (offer.priceBasis == null ||
            offer.priceBasis === "unknown" ||
            offer.priceBasis === "total_stay"),
      };
    }),
  );

  const withConverted = enriched.filter(
    (o) => o.conversion?.available && o.conversion.amount != null,
  );

  const lowestDisplayed = [...withConverted].sort(
    (a, b) => a.conversion.amount - b.conversion.amount,
  )[0] || null;

  const comparable = enriched
    .filter((o) => o.comparable && o.conversion.amount != null)
    .sort((a, b) => a.conversion.amount - b.conversion.amount);

  const lowestComparable = comparable[0] || null;

  const bookableRanked = enriched
    .filter(
      (o) =>
        o.bookable &&
        o.trueCost.fullyComparable &&
        o.conversion.available &&
        o.conversion.amount != null &&
        o.verificationStatus !== "failed_to_verify",
    )
    .sort((a, b) => a.conversion.amount - b.conversion.amount);

  const cheapestBookable = bookableRanked[0] || null;

  // Best verified = bookable + verified/partially verified + comparable preferred.
  const verifiedRanked = enriched
    .filter(
      (o) =>
        o.bookable &&
        o.conversion?.available &&
        o.conversion.amount != null &&
        ["verified", "partially_verified"].includes(o.verificationStatus) &&
        ["exact", "probable"].includes(o.propertyMatch),
    )
    .sort((a, b) => {
      const score = (o: any) =>
        (o.verificationStatus === "verified" ? 0 : 1) +
        (o.trueCost?.fullyComparable ? 0 : 2) +
        (o.bookingRisk?.level === "high" ? 3 : 0);
      const s = score(a) - score(b);
      if (s !== 0) return s;
      return a.conversion.amount - b.conversion.amount;
    });

  const bestVerified = verifiedRanked[0] || null;

  let estimatedSavings = null as null | {
    amount: number;
    currency: string;
    note: string;
  };
  if (
    lowestDisplayed &&
    bestVerified &&
    lowestDisplayed.id !== bestVerified.id &&
    lowestDisplayed.conversion?.amount != null &&
    bestVerified.conversion?.amount != null
  ) {
    const delta =
      bestVerified.conversion.amount - lowestDisplayed.conversion.amount;
    estimatedSavings = {
      amount: Math.round(delta * 100) / 100,
      currency: preferredCurrency,
      note:
        delta > 0
          ? "Best verified offer costs more than the lowest displayed — cheapest displayed may not be comparable or bookable"
          : "Best verified offer is at or below the lowest displayed amount among converted offers",
    };
  }

  const decision = {
    bestVerifiedOfferId: bestVerified?.id || null,
    lowestComparableId: lowestComparable?.id || null,
    lowestDisplayedId: lowestDisplayed?.id || null,
    cheapestBookableId: cheapestBookable?.id || null,
    estimatedSavings,
    verificationStatus: bestVerified?.verificationStatus || "unknown",
    mainRisks: (bestVerified?.bookingRisk?.warnings || [])
      .slice(0, 4)
      .map((w: any) => w.message),
    summary: buildDecisionSummary({
      bestVerified,
      lowestComparable,
      lowestDisplayed,
      cheapestBookable,
      preferredCurrency,
    }),
  };

  return {
    offers: enriched,
    lowestComparable,
    cheapestBookable,
    lowestDisplayed,
    bestVerified,
    decision,
    roomDiffNotes:
      lowestComparable && cheapestBookable
        ? compareRoomConditions(lowestComparable, cheapestBookable)
        : lowestComparable && bestVerified
          ? compareRoomConditions(lowestComparable, bestVerified)
          : null,
  };
}

function buildDecisionSummary({
  bestVerified,
  lowestComparable,
  lowestDisplayed,
  cheapestBookable,
  preferredCurrency,
}: any) {
  if (!bestVerified && !lowestComparable && !lowestDisplayed) {
    return "No verified offers yet. Failed or incomplete provider jobs are reported honestly — no prices are invented.";
  }

  const parts: string[] = [];
  if (bestVerified?.conversion?.available) {
    parts.push(
      `Best evidence-backed offer: ${bestVerified.provider} (${bestVerified.market}) at ${bestVerified.conversion.amount} ${preferredCurrency} — verification ${bestVerified.verificationStatus}.`,
    );
  } else if (lowestComparable?.conversion?.available) {
    parts.push(
      `Lowest comparable offer: ${lowestComparable.provider} (${lowestComparable.market}) — not labeled best verified because evidence is incomplete.`,
    );
  }

  if (
    lowestDisplayed &&
    bestVerified &&
    lowestDisplayed.id !== bestVerified.id
  ) {
    parts.push(
      `Lowest displayed converted offer differs from the best verified recommendation — review room, cancellation, and eligibility differences.`,
    );
  }

  if (cheapestBookable && bestVerified && cheapestBookable.id === bestVerified.id) {
    parts.push("The best verified offer is also the cheapest realistically bookable option among confirmed totals.");
  }

  if (bestVerified?.bookingRisk?.summary) {
    parts.push(bestVerified.bookingRisk.summary);
  }

  return parts.join(" ");
}
