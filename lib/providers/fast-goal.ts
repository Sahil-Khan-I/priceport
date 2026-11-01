import { roomPreferenceGoalLines } from "../search/room-preferences";

/** Short agent instruction. Priceport compares the results; the agent only extracts them. */
export function buildFastPriceGoal({
  hotel,
  bookingDetails,
  providerLabel,
}: {
  hotel: { name?: string; location?: string | null; address?: string | null };
  bookingDetails: {
    checkIn?: string;
    checkOut?: string;
    adults?: number;
    children?: number;
    rooms?: number;
    roomPreferences?: Record<string, unknown> | null;
  };
  providerLabel: string;
}) {
  const { checkIn, checkOut, adults, children, rooms } = bookingDetails;
  return [
    `Find the price of one hotel room on ${providerLabel}. Stop as soon as you have it.`,
    `Hotel: "${hotel?.name || ""}"${hotel?.location ? `, ${hotel.location}` : ""}.`,
    hotel?.address ? `Address hint: ${hotel.address}.` : null,
    `Stay: ${checkIn} to ${checkOut}, ${adults || 2} adults, ${children || 0} children, ${rooms || 1} room(s).`,
    roomPreferenceGoalLines(bookingDetails.roomPreferences),
    "1. Open the supplied hotel page if you are already on it. Otherwise search that exact name and open its property page. If it is a different hotel, set propertyMatch to unmatched and stop. Do not pick another hotel.",
    "2. Find the requested room category and bed. If that room is unavailable, set availability to unavailable and roomMatch to unavailable. Do not substitute a cheaper room from another category.",
    "3. Read the displayed price, its currency, and whether it is per_night, per_room_per_night, total_stay, per_person, or unknown. Put a nightly figure only in nightlyPrice and a stay total only in totalPrice. Also set displayedPrice to the figure actually shown.",
    "4. Return the property page URL and one short evidence line for the hotel, room, and price.",
    "Do not read reviews, photos, amenities, other room types, meals, cancellation, refunds, loyalty, payment, eligibility, or extras. Do not open checkout. Do not browse the rest of the site. Do not invent missing values.",
  ]
    .filter(Boolean)
    .join(" ");
}
