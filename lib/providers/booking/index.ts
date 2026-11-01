import { OFFER_OUTPUT_SCHEMA } from "@/lib/offers/schema";
import { buildFastPriceGoal } from "@/lib/providers/fast-goal";

export const id = "booking";
export const name = "Booking.com";
export const domains = ["booking.com"];

export function investigate({ hotel, bookingDetails, marketContext }) {
  const hotelName = hotel?.name || "";
  const location = hotel?.location || "";
  const { checkIn, checkOut, adults, children, rooms } = bookingDetails;

  const params = new URLSearchParams();
  const ss = [hotelName, location].filter(Boolean).join(", ");
  if (ss) params.set("ss", ss);
  if (checkIn) params.set("checkin", checkIn);
  if (checkOut) params.set("checkout", checkOut);
  params.set("group_adults", String(adults || 2));
  params.set("group_children", String(children || 0));
  params.set("no_rooms", String(rooms || 1));

  const startUrl =
    hotel?.providerUrl && String(hotel.providerUrl).includes("booking.com")
      ? hotel.providerUrl
      : `https://www.booking.com/searchresults.html?${params.toString()}`;

  return {
    provider: id,
    providerName: name,
    url: startUrl,
    goal: buildGoal({ hotel, bookingDetails, marketContext, providerLabel: name }),
    outputSchema: OFFER_OUTPUT_SCHEMA,
    browserProfile: "lite",
    proxyCountryCode:
      marketContext.access_method === "proxy"
        ? marketContext.actual_proxy_country
        : null,
    requireProxy: marketContext.access_method === "proxy",
  };
}

export function buildGoal(input: {
  hotel: any;
  bookingDetails: any;
  providerLabel: any;
  marketContext?: unknown;
}) {
  return buildFastPriceGoal({
    hotel: input.hotel,
    bookingDetails: input.bookingDetails,
    providerLabel: input.providerLabel,
  });
}
