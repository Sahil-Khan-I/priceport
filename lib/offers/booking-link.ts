/**
 * Booking link resolution.
 * Uses only the URL extracted from the investigation. Never fabricates links
 * and never presents a generic homepage as a direct property page.
 */

export type BookingLink = {
  url: string | null;
  kind: "property" | "search" | "official" | "unavailable";
  provider: string;
  label: string;
  note: string | null;
};

const PROVIDER_BY_HOST: Array<[RegExp, string]> = [
  [/(^|\.)booking\.com$/, "Booking.com"],
  [/(^|\.)agoda\.com$/, "Agoda"],
  [/(^|\.)expedia\.[a-z.]+$/, "Expedia"],
  [/(^|\.)hotels\.com$/, "Hotels.com"],
];

const BLOCKED = ["localhost", "127.0.0.1", "0.0.0.0", "::1"];

export function resolveBookingLink(offer: {
  sourceUrl?: string | null;
  provider?: string | null;
}): BookingLink {
  const providerName = String(offer.provider || "").trim() || "provider";
  const url = safeUrl(offer.sourceUrl);
  if (!url) {
    return {
      url: null,
      kind: "unavailable",
      provider: providerName,
      label: "No booking link available",
      note: "This check did not return a usable page address.",
    };
  }

  const parsed = new URL(url);
  const host = parsed.hostname.toLowerCase();
  const known = PROVIDER_BY_HOST.find(([pattern]) => pattern.test(host));
  const provider = known ? known[1] : providerName;
  const path = parsed.pathname.toLowerCase();
  const depth = path.split("/").filter(Boolean).length;
  const hasSearchParams = [...parsed.searchParams.keys()].some((key) =>
    /^(ss|q|checkin|checkout|check_in|check_out|destination|city|textToSearch)$/i.test(key),
  );

  if (!known) {
    const isOfficial = /official/i.test(providerName);
    if (isOfficial && depth >= 1) {
      return {
        url,
        kind: "official",
        provider: "Hotel website",
        label: "Visit hotel website",
        note: null,
      };
    }
    return {
      url,
      kind: "unavailable",
      provider,
      label: "Open source page",
      note: "Not a recognised booking provider page.",
    };
  }

  const looksLikeProperty =
    /\/hotel\//.test(path) ||
    /\/(hotels?)\/[^/]+/.test(path) && depth >= 2 ||
    /\.html?$/.test(path) && depth >= 2 ||
    /\/h\d{3,}/.test(path);

  if (looksLikeProperty && !/search/.test(path)) {
    return {
      url,
      kind: "property",
      provider,
      label: `View on ${provider}`,
      note: null,
    };
  }

  if (hasSearchParams || /search/.test(path)) {
    return {
      url,
      kind: "search",
      provider,
      label: `Search on ${provider}`,
      note: "Provider search page, not a direct property page.",
    };
  }

  return {
    url: null,
    kind: "unavailable",
    provider,
    label: "No direct property page",
    note: "Only a generic provider page was returned.",
  };
}

function safeUrl(input?: string | null) {
  if (!input || typeof input !== "string") return null;
  try {
    const parsed = new URL(input.trim());
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    const host = parsed.hostname.toLowerCase();
    if (BLOCKED.includes(host) || host.endsWith(".local") || host.endsWith(".internal")) {
      return null;
    }
    if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}
