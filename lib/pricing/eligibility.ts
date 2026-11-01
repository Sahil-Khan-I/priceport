/**
 * Eligibility analysis foundation.
 * Distinguishes availability vs whether the user can actually book.
 */
export function assessEligibility(offer: any = {}) {
  const notes = Array.isArray(offer.eligibility) ? [...offer.eligibility] : [];

  if (offer.availability === "unavailable") {
    notes.push("Offer unavailable");
  }

  return {
    bookable: offer.availability === "available" && notes.length === 0,
    notes,
  };
}
