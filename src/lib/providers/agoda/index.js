import { OFFER_OUTPUT_SCHEMA } from "@/lib/offers/schema";
import { buildGoal } from "@/lib/providers/booking";

export const id = "agoda";
export const name = "Agoda";
export const domains = ["agoda.com"];

export function investigate({ hotel, bookingDetails, marketContext }) {
  const { checkIn, checkOut, adults, children, rooms } = bookingDetails;
  const params = new URLSearchParams();
  const city = [hotel?.name, hotel?.location].filter(Boolean).join(" ");
  if (city) params.set("city", city);
  if (checkIn) params.set("checkIn", checkIn);
  if (checkOut) params.set("checkOut", checkOut);
  params.set("adults", String(adults || 2));
  params.set("children", String(children || 0));
  params.set("rooms", String(rooms || 1));

  const startUrl =
    hotel?.providerUrl && String(hotel.providerUrl).includes("agoda.com")
      ? hotel.providerUrl
      : `https://www.agoda.com/search?${params.toString()}`;

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
