import { searchProviders } from "@/lib/tinyfish/search";
import { assertSafeHttpUrl } from "@/lib/security/urls";
import { isTinyFishConfigured } from "@/lib/tinyfish/config";

/**
 * Discover hotel candidates via TinyFish Search — no hardcoded listings.
 */
export async function discoverHotels({ query, location = "US", directUrl = null }) {
  if (directUrl) {
    const safe = assertSafeHttpUrl(directUrl);
    return {
      configured: isTinyFishConfigured(),
      source: "direct_url",
      results: [
        {
          id: `url_${hash(safe)}`,
          name: inferNameFromUrl(safe) || "Property from URL",
          location: null,
          address: null,
          providerUrl: safe,
          officialWebsite: null,
          evidence: ["User-supplied direct URL"],
          snippet: null,
        },
      ],
    };
  }

  const q = String(query || "").trim();
  if (!q) {
    throw new Error("query or directUrl is required");
  }

  if (!isTinyFishConfigured()) {
    return {
      configured: false,
      source: "tinyfish_search",
      results: [],
      error:
        "TinyFish is not configured. Add your server-side API key to enable live hotel discovery.",
    };
  }

  const response = await searchProviders({
    query: `${q} hotel official site OR booking`,
    location,
    language: "en",
  });

  const results = mapSearchResults(response, q);

  return {
    configured: true,
    source: "tinyfish_search",
    results,
    rawMeta: {
      resultCount: results.length,
    },
  };
}

function mapSearchResults(response, query) {
  const items =
    response?.results ||
    response?.organic ||
    response?.items ||
    response?.data ||
    [];

  if (!Array.isArray(items)) return [];

  return items
    .map((item, index) => {
      const url =
        item.url || item.link || item.href || item.source_url || item.sourceUrl || null;
      let safeUrl = null;
      if (url) {
        try {
          safeUrl = assertSafeHttpUrl(String(url));
        } catch {
          safeUrl = null;
        }
      }

      const name =
        item.title ||
        item.name ||
        item.hotel_name ||
        item.headline ||
        `Result ${index + 1}`;

      return {
        id: `search_${hash(`${name}|${safeUrl || index}`)}`,
        name: String(name).replace(/\s+/g, " ").trim(),
        location:
          item.location ||
          item.city ||
          item.region ||
          extractLocationHint(item.snippet || item.description || "") ||
          null,
        address: item.address || null,
        providerUrl: safeUrl,
        officialWebsite: looksOfficial(safeUrl) ? safeUrl : null,
        evidence: [
          item.snippet || item.description || null,
          safeUrl ? `Source: ${safeUrl}` : null,
          `Matched query: ${query}`,
        ].filter(Boolean),
        snippet: item.snippet || item.description || null,
      };
    })
    .filter((row) => row.providerUrl || row.name);
}

const META_OR_OTA_HOST_PARTS = [
  "booking.com",
  "agoda.com",
  "expedia.",
  "hotels.com",
  "tripadvisor.",
  "skyscanner.",
  "kayak.",
  "trivago.",
  "tripadvisor.",
  "google.",
  "bing.com",
  "makemytrip.",
  "tripadvisor",
];

function looksOfficial(url) {
  if (!url) return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return !META_OR_OTA_HOST_PARTS.some((part) => host.includes(part));
  } catch {
    return false;
  }
}

function extractLocationHint(text) {
  if (!text) return null;
  const match = String(text).match(/\b(?:in|at)\s+([A-Z][A-Za-z\s-]{2,40})/);
  return match ? match[1].trim() : null;
}

function inferNameFromUrl(url) {
  try {
    const { hostname, pathname } = new URL(url);
    const segment = pathname.split("/").filter(Boolean)[0] || hostname;
    return decodeURIComponent(segment).replace(/[-_]+/g, " ");
  } catch {
    return null;
  }
}

function hash(value) {
  let h = 0;
  const s = String(value);
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}
