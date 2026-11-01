import { OFFER_OUTPUT_SCHEMA } from "@/lib/offers/schema";
import { buildGoal } from "@/lib/providers/booking";

export const id = "expedia";
export const name = "Expedia";
export const domains = ["expedia.com", "expedia.co.uk", "expedia.de"];

export function investigate({ hotel, bookingDetails, marketContext }) {
  const { checkIn, checkOut, adults, children, rooms } = bookingDetails;
  const params = new URLSearchParams();
  const destination = [hotel?.name, hotel?.location].filter(Boolean).join(", ");
  if (destination) params.set("destination", destination);
  if (checkIn) params.set("startDate", checkIn);
  if (checkOut) params.set("endDate", checkOut);
  params.set("adults", String(adults || 2));
  params.set("children", String(children || 0));
  params.set("rooms", String(rooms || 1));

  const startUrl =
    hotel?.providerUrl && String(hotel.providerUrl).includes("expedia")
      ? hotel.providerUrl
      : `https://www.expedia.com/Hotel-Search?${params.toString()}`;

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
