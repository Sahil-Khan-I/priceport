/** Confirmed by the provider. Timeouts and missing fields are not unavailability. */

export function explicitUnavailable(input: any) {
  if (!input || typeof input !== "object") return false;
  const availability = String(input.availability || "").toLowerCase();
  const roomMatch = String(input.roomMatch || input.room_match || "").toLowerCase();
  const propertyMatch = String(input.propertyMatch || input.property_match || "").toLowerCase();
  const extraction = String(input.extractionStatus || "").toLowerCase();
  return (
    availability === "unavailable" ||
    roomMatch === "unavailable" ||
    propertyMatch === "unmatched" ||
    extraction === "unavailable"
  );
}

export function clearUnavailablePrices<T extends Record<string, any>>(offer: T) {
  return {
    ...offer,
    basePrice: null,
    nightlyPrice: null,
    totalPrice: null,
    displayedUnscoped: null,
    estimatedStayTotal: null,
    taxes: null,
    mandatoryFees: null,
    currency: offer.currency && explicitUnavailable(offer) ? "" : offer.currency,
    priceNote:
      offer.propertyMatch === "unmatched"
        ? "This was not the requested hotel. No other property was searched."
        : "The requested room is unavailable on this provider. No alternative room was searched.",
    totalStatus: "unknown",
    comparisonClass: offer.propertyMatch === "unmatched" ? "not_comparable" : "room_unavailable",
    availability: offer.propertyMatch === "unmatched" ? offer.availability : "unavailable",
  };
}
