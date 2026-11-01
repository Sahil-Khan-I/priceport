import { calculateTrueCost } from "./true-cost";
import { convertAmount } from "./currency";
import { compareRoomConditions } from "@/lib/hotels/matching";

/**
 * Rank only offers with sufficiently established comparable totals.
 */
export async function rankOffers(offers: any[] = [], preferredCurrency = "USD") {
  const enriched: any[] = [];

  for (const offer of offers) {
    const trueCost = calculateTrueCost(offer);
    const conversion =
      trueCost.displayedTotal != null && offer.currency
        ? await convertAmount(
            trueCost.displayedTotal,
            offer.currency,
            preferredCurrency,
          )
        : { available: false, reason: "No total to convert" };

    const bookable =
      offer.availability === "available" &&
      ["exact", "probable"].includes(offer.propertyMatch) &&
      (!Array.isArray(offer.eligibility) ||
        offer.eligibility.every(
          (item: unknown) =>
            !/restrict|ineligib|not available|cannot/i.test(String(item)),
        ));

    enriched.push({
      ...offer,
      trueCost,
      conversion,
      bookable,
      comparable:
        trueCost.fullyComparable &&
        conversion.available &&
        ["exact", "probable"].includes(offer.propertyMatch),
    });
  }

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
        o.conversion.amount != null,
    )
    .sort((a, b) => a.conversion.amount - b.conversion.amount);

  const cheapestBookable = bookableRanked[0] || null;

  return {
    offers: enriched,
    lowestComparable,
    cheapestBookable,
    roomDiffNotes:
      lowestComparable && cheapestBookable
        ? compareRoomConditions(lowestComparable, cheapestBookable)
        : null,
  };
}
