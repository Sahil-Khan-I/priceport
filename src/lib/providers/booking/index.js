import { OFFER_OUTPUT_SCHEMA } from "@/lib/offers/schema";

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

export function buildGoal({ hotel, bookingDetails, marketContext, providerLabel }) {
  const { checkIn, checkOut, adults, children, rooms, childrenAges } =
    bookingDetails;
  return [
    `You are investigating a hotel booking on ${providerLabel}.`,
    `Find the exact property matching "${hotel.name}"${hotel.location ? ` in ${hotel.location}` : ""}.`,
    hotel.address ? `Address hint: ${hotel.address}.` : null,
    `Search for a stay from ${checkIn} to ${checkOut}, for ${adults} adults` +
      (children ? `, ${children} children` : "") +
      (childrenAges?.length ? ` (ages: ${childrenAges.join(", ")})` : "") +
      `, in ${rooms} room(s).`,
    marketContext.access_method === "storefront"
      ? `Prefer the regional storefront/market context for ${marketContext.selected_market} if the site exposes locale or currency options. Do not claim an IP geo investigation.`
      : marketContext.actual_proxy_country
        ? `This browser session may be proxied via ${marketContext.actual_proxy_country}.`
        : null,
    "Retrieve available room options for the exact property.",
    "Extract: room category, occupancy, meal plan, cancellation conditions, displayed base price, currency, taxes, mandatory fees, total price if established, availability, eligibility restrictions, and source URL.",
    "Set propertyMatch to exact, probable, partial, unmatched, or unknown.",
    "Do not invent missing values. If the exact property cannot be found, set propertyMatch to unmatched and explain in notes.",
    "If pricing is unavailable, report null prices rather than estimating.",
    "Return structured JSON matching the schema.",
  ]
    .filter(Boolean)
    .join(" ");
}
