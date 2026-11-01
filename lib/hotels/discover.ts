import { searchProviders } from "@/lib/tinyfish/search";
import { assertSafeHttpUrl } from "@/lib/security/urls";
import { isTinyFishConfigured } from "@/lib/tinyfish/config";
import {
  buildHotelSearchQuery,
  classifyUrl,
  extractSearchHits,
  mapDestinationToSearchLocation,
  rankAndFilterCandidates,
  type DestinationContext,
} from "@/lib/hotels/discovery-relevance";
import {
  discoveryCacheKey,
  withDiscoveryCache,
} from "@/lib/hotels/discovery-cache";

/**
 * Discover hotel candidates via TinyFish Search + relevance filtering.
 * No hardcoded listings. No fabricated candidates.
 */
export async function discoverHotels({
  query,
  location,
  directUrl = null,
  destination = null,
  destinationCity = null,
  destinationCountry = null,
  destinationCountryCode = null,
  limit = 6,
  browse = false,
}: {
  query?: string;
  location?: string;
  directUrl?: string | null;
  destination?: string | null;
  destinationCity?: string | null;
  destinationCountry?: string | null;
  destinationCountryCode?: string | null;
  limit?: number;
  browse?: boolean;
}) {
  const destCtx: DestinationContext = {
    city: destinationCity || parseCity(destination),
    country: destinationCountry || parseCountry(destination),
    countryCode: destinationCountryCode || null,
    label: destination || null,
  };

  if (directUrl) {
    const safe = assertSafeHttpUrl(directUrl);
    const sourceClass = classifyUrl(safe);
    return {
      configured: isTinyFishConfigured(),
      source: "direct_url",
      results: [
        {
          id: `url_${hash(safe)}`,
          name: inferNameFromUrl(safe) || "Property from URL",
          city: destCtx.city,
          country: destCtx.country,
          location: destCtx.label || destCtx.city,
          address: null,
          providerUrl: safe,
          officialWebsite:
            sourceClass === "official_property" ? safe : null,
          sourceDomain: safeHostname(safe),
          sourceClass,
          evidence: [
            "User-supplied direct URL — discovery hint, not verified identity",
          ],
          snippet: null,
          relevanceScore: 50,
          discoveryStatus: "discovery_candidate",
          discoverySource: "direct_url",
        },
      ],
      queryUsed: null,
      searchLocation: null,
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
      queryUsed: null,
      searchLocation: null,
    };
  }

  const searchQuery = browse
    ? `hotels in "${destCtx.city || q}"${destCtx.country ? ` "${destCtx.country}"` : ""} property -directory`
    : buildHotelSearchQuery(q, destCtx);
  const searchLocation =
    location || mapDestinationToSearchLocation(destCtx, "US");
  const cacheKey = discoveryCacheKey({
    query: browse ? `browse:${destCtx.city || q}` : q,
    city: destCtx.city,
    country: destCtx.country,
    countryCode: destCtx.countryCode,
    language: "en",
    mode: browse ? "browse" : "named",
  });

  const { value, cached } = await withDiscoveryCache(cacheKey, async () => {
    const response = await searchProviders({
      query: searchQuery,
      location: searchLocation,
      language: "en",
      purpose: browse
        ? `Find real hotel property pages in ${destCtx.city || "the destination"}`
        : destCtx.city
          ? `Find the specific hotel property matching "${q}" in ${destCtx.city}${destCtx.country ? `, ${destCtx.country}` : ""}`
          : `Find hotel property pages matching "${q}"`,
    });

    const hits = extractSearchHits(response);
    const results = rankAndFilterCandidates(hits, {
      query: browse ? destCtx.city || q : q,
      destination: destCtx,
      limit: Math.max(1, Math.min(Number(limit) || 6, 8)),
      minScore: browse ? 18 : destCtx.city ? 20 : 12,
    });

    return {
      configured: true as const,
      source: "tinyfish_search",
      results,
      queryUsed: searchQuery,
      searchLocation,
      error: null as string | null,
      rawMeta: {
        rawHitCount: hits.length,
        keptCount: results.length,
      },
    };
  });

  return { ...value, cached };
}

function parseCity(label: string | null | undefined) {
  if (!label) return null;
  const part = String(label).split(",")[0]?.trim();
  return part || null;
}

function parseCountry(label: string | null | undefined) {
  if (!label) return null;
  const parts = String(label).split(",");
  if (parts.length < 2) return null;
  return parts.slice(1).join(",").trim() || null;
}

function safeHostname(url: string) {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

function inferNameFromUrl(url: string) {
  try {
    const { pathname, hostname } = new URL(url);
    const segment = pathname.split("/").filter(Boolean).pop() || hostname;
    return decodeURIComponent(segment)
      .replace(/[-_]+/g, " ")
      .replace(/\.html?$/i, "");
  } catch {
    return null;
  }
}

function hash(value: string) {
  let h = 0;
  for (let i = 0; i < value.length; i += 1) h = (h * 31 + value.charCodeAt(i)) >>> 0;
  return h.toString(36);
}
