import { OFFER_OUTPUT_SCHEMA } from "@/lib/offers/schema";
import { buildGoal } from "@/lib/providers/booking";
import { assertSafeHttpUrl } from "@/lib/security/urls";

export const id = "official";
export const name = "Official hotel website";
export const domains = [];

export function investigate({ hotel, bookingDetails, marketContext }) {
  const candidate =
    hotel?.officialWebsite ||
    (hotel?.providerUrl && !isOta(hotel.providerUrl) ? hotel.providerUrl : null);

  if (!candidate) {
    return {
      provider: id,
      providerName: name,
      unsupported: true,
      reason:
        "No official hotel website URL is available for this property. Provide a direct official URL to investigate.",
    };
  }

  const url = assertSafeHttpUrl(candidate);

  return {
    provider: id,
    providerName: name,
    url,
    goal: buildGoal({
      hotel,
      bookingDetails,
      marketContext,
      providerLabel: "the hotel's official website",
    }),
    outputSchema: OFFER_OUTPUT_SCHEMA,
    browserProfile: "lite",
    proxyCountryCode:
      marketContext.access_method === "proxy"
        ? marketContext.actual_proxy_country
        : null,
    requireProxy: marketContext.access_method === "proxy",
  };
}

function isOta(url) {
  const host = String(url).toLowerCase();
  return (
    host.includes("booking.com") ||
    host.includes("agoda.com") ||
    host.includes("expedia.") ||
    host.includes("hotels.com")
  );
}
