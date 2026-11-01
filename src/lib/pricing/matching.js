/**
 * Offer matching — Phase 01 stub.
 * Future: compare property identity, room type, board basis, cancellation, dates.
 */
export function matchOffers(offers = []) {
  return offers.map((offer) => ({
    ...offer,
    match_status: offer.match_status || "unknown",
  }));
}
