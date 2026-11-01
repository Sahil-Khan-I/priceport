export function validateDiscoverRequest(body: any = {}) {
  const errors: string[] = [];
  const query = typeof body.query === "string" ? body.query.trim() : "";
  const directUrl =
    typeof body.directUrl === "string" ? body.directUrl.trim() : "";

  if (!query && !directUrl) errors.push("Provide query or directUrl");

  return {
    ok: errors.length === 0,
    errors,
    value: {
      query,
      directUrl: directUrl || null,
      location: body.location || "US",
      destination:
        typeof body.destination === "string" ? body.destination.trim() : null,
      limit: Number.isFinite(Number(body.limit)) ? Number(body.limit) : 8,
    },
  };
}

export function validateInvestigationRequest(body: any = {}) {
  const errors: string[] = [];
  const hotel = body.hotel || {};
  const booking = body.bookingDetails || {};

  if (!hotel.name || typeof hotel.name !== "string") {
    errors.push("hotel.name is required");
  }
  if (!booking.checkIn) errors.push("checkIn is required");
  if (!booking.checkOut) errors.push("checkOut is required");
  if (booking.checkIn && booking.checkOut && booking.checkOut <= booking.checkIn) {
    errors.push("checkOut must be after checkIn");
  }

  const adults = Number(booking.adults);
  const children = Number(booking.children ?? 0);
  const rooms = Number(booking.rooms ?? 1);
  if (!Number.isFinite(adults) || adults < 1) errors.push("adults must be >= 1");
  if (!Number.isFinite(children) || children < 0) {
    errors.push("children must be >= 0");
  }
  if (!Number.isFinite(rooms) || rooms < 1) errors.push("rooms must be >= 1");

  if (!Array.isArray(body.providers) || body.providers.length === 0) {
    errors.push("providers must be a non-empty array");
  }
  if (!Array.isArray(body.markets) || body.markets.length === 0) {
    errors.push("markets must be a non-empty array");
  }

  const childrenAges = Array.isArray(booking.childrenAges)
    ? booking.childrenAges.map(Number)
    : [];

  if (children > 0 && childrenAges.length !== children) {
    errors.push("childrenAges must be provided for each child");
  }

  return {
    ok: errors.length === 0,
    errors,
    value: {
      hotel: {
        name: String(hotel.name || "").trim(),
        location: hotel.location || null,
        address: hotel.address || null,
        providerUrl: hotel.providerUrl || null,
        officialWebsite: hotel.officialWebsite || null,
        evidence: hotel.evidence || [],
      },
      bookingDetails: {
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        adults,
        children,
        childrenAges,
        rooms,
      },
      homeCountry: body.homeCountry || null,
      preferredCurrency: body.preferredCurrency || "USD",
      providers: body.providers || [],
      markets: body.markets || [],
      marketAccess: body.marketAccess || {},
    },
  };
}
