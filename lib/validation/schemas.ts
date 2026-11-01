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
      // Optional override only — discovery prefers destinationCountryCode.
      location:
        typeof body.location === "string" && body.location.trim()
          ? body.location.trim()
          : undefined,
      destination:
        typeof body.destination === "string" ? body.destination.trim() : null,
      destinationCity:
        typeof body.destinationCity === "string"
          ? body.destinationCity.trim()
          : null,
      destinationCountry:
        typeof body.destinationCountry === "string"
          ? body.destinationCountry.trim()
          : null,
      destinationCountryCode:
        typeof body.destinationCountryCode === "string"
          ? body.destinationCountryCode.trim()
          : null,
      limit: Number.isFinite(Number(body.limit)) ? Number(body.limit) : 6,
    },
  };
}

import { normalizeRoomPreferences, validateGuestCounts } from "../search/room-preferences";

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
  const childrenAges = Array.isArray(booking.childrenAges)
    ? booking.childrenAges.map(Number)
    : [];
  errors.push(...validateGuestCounts({ adults, children, childrenAges, rooms }));

  if (!Array.isArray(body.providers) || body.providers.length === 0) {
    errors.push("providers must be a non-empty array");
  }
  if (!Array.isArray(body.markets) || body.markets.length === 0) {
    errors.push("markets must be a non-empty array");
  }

  const roomPreferences = normalizeRoomPreferences(
    body.roomPreferences || booking.roomPreferences,
  );
  errors.push(...roomPreferences.errors);

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
        roomPreferences: roomPreferences.value,
      },
      roomPreferences: roomPreferences.value,
      homeCountry: body.homeCountry || null,
      preferredCurrency: body.preferredCurrency || "USD",
      providers: body.providers || [],
      markets: body.markets || [],
      marketAccess: body.marketAccess || {},
    },
  };
}
