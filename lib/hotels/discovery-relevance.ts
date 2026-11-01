/**
 * Deterministic hotel discovery scoring and URL classification.
 * Rejects irrelevant cities/countries and generic provider homepages.
 */

export type UrlClass =
  | "ota_property"
  | "official_property"
  | "listing"
  | "generic_homepage"
  | "editorial"
  | "other";

export type DestinationContext = {
  city?: string | null;
  country?: string | null;
  countryCode?: string | null;
  label?: string | null;
};

export type RawSearchHit = {
  title?: string | null;
  name?: string | null;
  url?: string | null;
  link?: string | null;
  href?: string | null;
  snippet?: string | null;
  description?: string | null;
  site_name?: string | null;
  location?: string | null;
  city?: string | null;
  address?: string | null;
  position?: number | null;
};

export type ScoredCandidate = {
  id: string;
  name: string;
  city: string | null;
  country: string | null;
  location: string | null;
  address: string | null;
  providerUrl: string | null;
  officialWebsite: string | null;
  sourceDomain: string | null;
  sourceClass: UrlClass;
  snippet: string | null;
  evidence: string[];
  relevanceScore: number;
  discoveryStatus: "discovery_candidate";
  discoverySource: "tinyfish_search" | "direct_url";
};

const OTA_HOSTS = [
  "booking.com",
  "agoda.com",
  "expedia.",
  "hotels.com",
  "tripadvisor.",
  "trivago.",
  "kayak.",
  "skyscanner.",
  "makemytrip.",
  "hotelscombined.",
  "orbitz.",
  "travelocity.",
  "priceline.",
];

const EDITORIAL_HOSTS = [
  "wikipedia.org",
  "wikitravel.org",
  "lonelyplanet.",
  "timeout.",
  "tripadvisor.com/Attraction",
  "reddit.com",
  "quora.com",
  "youtube.com",
  "facebook.com",
  "instagram.com",
  "medium.com",
  "blog.",
];

const GENERIC_PATHS = ["/", "/hotels", "/hotel", "/search", "/en", "/en-us", "/en-gb"];

/** Map destination country code → TinyFish Search `location` value (ISO-style region bias). */
export function mapDestinationToSearchLocation(
  destination: DestinationContext | null | undefined,
  fallback = "US",
): string {
  const code = String(destination?.countryCode || "").toUpperCase();
  const known: Record<string, string> = {
    AE: "AE",
    IN: "IN",
    GB: "GB",
    US: "US",
    DE: "DE",
    FR: "FR",
    JP: "JP",
    AU: "AU",
    CA: "CA",
    SG: "SG",
    TH: "TH",
    ID: "ID",
  };
  // Prefer country code when we have one — do NOT use traveler home country.
  if (code && (known[code] || code.length === 2)) return code;
  const city = String(destination?.city || "").trim();
  if (city) return city;
  return fallback;
}

export function buildHotelSearchQuery(
  query: string,
  destination: DestinationContext | null | undefined,
): string {
  const q = String(query || "").trim();
  const city = String(destination?.city || "").trim();
  const country = String(destination?.country || "").trim();
  if (city && country) {
    return `${q} hotel "${city}" "${country}" -directory -cheap -deals`;
  }
  if (city) return `${q} hotel "${city}" -directory`;
  return `${q} hotel property booking`;
}

export function classifyUrl(url: string | null | undefined): UrlClass {
  if (!url) return "other";
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return "other";
  }

  const host = parsed.hostname.toLowerCase();
  const path = parsed.pathname.toLowerCase() || "/";
  const full = `${host}${path}`;

  if (EDITORIAL_HOSTS.some((p) => full.includes(p) || host.includes(p))) {
    return "editorial";
  }

  const isOta = OTA_HOSTS.some((p) => host.includes(p));
  const pathDepth = path.split("/").filter(Boolean).length;
  const isGenericPath =
    GENERIC_PATHS.includes(path) ||
    pathDepth <= 1 ||
    /\/(search|hotels?)\/?$/i.test(path);

  if (isOta) {
    // Booking property pages usually have deeper paths: /hotel/ae/name.html
    if (
      pathDepth >= 2 &&
      (/\/hotel\//i.test(path) ||
        /\/h\d/i.test(path) ||
        /hotel[_-]?id/i.test(path) ||
        path.endsWith(".html"))
    ) {
      return "ota_property";
    }
    if (isGenericPath) return "generic_homepage";
    return "listing";
  }

  if (isGenericPath && pathDepth <= 1) return "generic_homepage";

  // Non-OTA with property-like path → possible official property page.
  if (pathDepth >= 1 && !isGenericPath) return "official_property";
  return "other";
}

export function scoreHotelCandidate({
  query,
  destination,
  title,
  snippet,
  url,
  sourceClass,
}: {
  query: string;
  destination?: DestinationContext | null;
  title: string;
  snippet?: string | null;
  url?: string | null;
  sourceClass: UrlClass;
}): { score: number; reasons: string[]; city: string | null; country: string | null } {
  const reasons: string[] = [];
  let score = 0;
  const q = normalize(query);
  const titleN = normalize(title);
  const blob = normalize(`${title} ${snippet || ""} ${url || ""}`);
  const city = destination?.city ? normalize(destination.city) : "";
  const country = destination?.country ? normalize(destination.country) : "";
  const countryCode = String(destination?.countryCode || "").toLowerCase();

  // Hard reject generic homepages and editorials early via score floor later.
  if (sourceClass === "generic_homepage") {
    reasons.push("Generic provider homepage");
    return { score: -100, reasons, city: null, country: null };
  }
  if (sourceClass === "editorial") {
    reasons.push("Editorial / non-property page");
    return { score: -80, reasons, city: null, country: null };
  }

  // Name similarity
  if (q && titleN === q) {
    score += 40;
    reasons.push("Exact name match");
  } else if (q && (titleN.includes(q) || q.includes(titleN))) {
    score += 28;
    reasons.push("Name containment");
  } else if (q) {
    const qTokens = q.split(" ").filter((t) => t.length > 2);
    const overlap = qTokens.filter((t) => titleN.includes(t)).length;
    if (overlap === 0) {
      score -= 35;
      reasons.push("No query tokens in title");
    } else {
      score += Math.min(24, overlap * 8);
      reasons.push(`Token overlap ${overlap}/${qTokens.length}`);
    }
  }

  // Destination city / country
  let inferredCity: string | null = null;
  let inferredCountry: string | null = null;

  if (city) {
    if (blob.includes(city) || titleN.includes(city)) {
      score += 30;
      reasons.push(`City match: ${destination?.city}`);
      inferredCity = destination?.city || null;
    } else {
      score -= 40;
      reasons.push(`Missing destination city (${destination?.city})`);
    }
  }

  if (country) {
    const countryAliases = countryAliasesFor(destination?.countryCode, country);
    if (countryAliases.some((a) => blob.includes(a))) {
      score += 20;
      reasons.push(`Country match: ${destination?.country}`);
      inferredCountry = destination?.country || null;
    } else if (city && blob.includes(city)) {
      // City matched; country may be implied
      score += 5;
    } else {
      score -= 25;
      reasons.push(`Missing destination country (${destination?.country})`);
    }
  }

  // URL country path hints (e.g. booking.com/hotel/ae/)
  if (url && countryCode) {
    try {
      const path = new URL(url).pathname.toLowerCase();
      if (path.includes(`/${countryCode}/`) || path.includes(`-${countryCode}-`)) {
        score += 12;
        reasons.push("URL path includes destination country code");
      }
    } catch {
      // ignore
    }
  }

  // Penalize known wrong-place signals when destination is set
  if (city) {
    for (const wrong of WRONG_PLACE_HINTS) {
      if (wrong === city) continue;
      if (blob.includes(wrong) && !blob.includes(city)) {
        score -= 45;
        reasons.push(`Unrelated location signal: ${wrong}`);
        break;
      }
    }
  }

  // Source class bonus
  if (sourceClass === "ota_property") {
    score += 18;
    reasons.push("OTA property page");
  } else if (sourceClass === "official_property") {
    score += 14;
    reasons.push("Likely property page");
  } else if (sourceClass === "listing") {
    score += 4;
  }

  // Cheap / directory spam
  if (/\b(cheap hotels|best deals|top 10|directory)\b/i.test(`${title} ${snippet || ""}`)) {
    score -= 20;
    reasons.push("Directory / deals page language");
  }

  return {
    score,
    reasons,
    city: inferredCity || extractCityFromText(snippet || title, destination) || null,
    country: inferredCountry || destination?.country || null,
  };
}

export function rankAndFilterCandidates(
  hits: RawSearchHit[],
  {
    query,
    destination,
    limit = 6,
    minScore = 15,
  }: {
    query: string;
    destination?: DestinationContext | null;
    limit?: number;
    minScore?: number;
  },
): ScoredCandidate[] {
  const seen = new Set<string>();
  const scored: ScoredCandidate[] = [];

  for (const hit of hits) {
    const urlRaw = hit.url || hit.link || hit.href || null;
    let safeUrl: string | null = null;
    if (urlRaw) {
      try {
        safeUrl = new URL(String(urlRaw)).toString();
      } catch {
        safeUrl = null;
      }
    }

    const title = String(hit.title || hit.name || "").replace(/\s+/g, " ").trim();
    if (!title && !safeUrl) continue;

    const sourceClass = classifyUrl(safeUrl);
    const { score, reasons, city, country } = scoreHotelCandidate({
      query,
      destination,
      title: title || "Untitled result",
      snippet: hit.snippet || hit.description,
      url: safeUrl,
      sourceClass,
    });

    const dedupeKey = `${normalize(title)}|${safeUrl ? new URL(safeUrl).hostname : ""}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    if (score < minScore) continue;

    let domain: string | null = null;
    try {
      domain = safeUrl ? new URL(safeUrl).hostname : null;
    } catch {
      domain = null;
    }

    const locationParts = [city, country].filter(Boolean);
    scored.push({
      id: `search_${hash(dedupeKey)}`,
      name: title || inferNameFromUrl(safeUrl) || "Property candidate",
      city,
      country,
      location: locationParts.length
        ? locationParts.join(", ")
        : destination?.label || null,
      address: hit.address || null,
      providerUrl: safeUrl,
      officialWebsite: sourceClass === "official_property" ? safeUrl : null,
      sourceDomain: domain,
      sourceClass,
      snippet: hit.snippet || hit.description || null,
      evidence: [
        hit.snippet || hit.description || null,
        safeUrl ? `Source: ${domain}` : null,
        `Relevance ${score}`,
        ...reasons.slice(0, 3),
        "Discovery candidate — not yet identity-verified",
      ].filter(Boolean) as string[],
      relevanceScore: score,
      discoveryStatus: "discovery_candidate",
      discoverySource: "tinyfish_search",
    });
  }

  return scored
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, Math.max(1, Math.min(limit, 8)));
}

export function extractSearchHits(response: unknown): RawSearchHit[] {
  if (!response || typeof response !== "object") return [];
  const r = response as Record<string, unknown>;
  const items = r.results || r.organic || r.items || r.data;
  return Array.isArray(items) ? (items as RawSearchHit[]) : [];
}

function countryAliasesFor(code?: string | null, countryNorm?: string) {
  const aliases = new Set<string>();
  if (countryNorm) aliases.add(countryNorm);
  const c = String(code || "").toUpperCase();
  const map: Record<string, string[]> = {
    AE: ["uae", "united arab emirates", "dubai", "abu dhabi"],
    IN: ["india", "bengaluru", "bangalore", "mumbai", "delhi"],
    GB: ["united kingdom", "uk", "england", "london"],
    US: ["united states", "usa", "america"],
    SG: ["singapore"],
    TH: ["thailand", "bangkok"],
    ID: ["indonesia", "bali"],
    JP: ["japan", "tokyo"],
    AU: ["australia", "sydney", "melbourne"],
    FR: ["france", "paris"],
    DE: ["germany", "berlin"],
    CA: ["canada", "toronto", "vancouver"],
  };
  for (const a of map[c] || []) aliases.add(a);
  return [...aliases];
}

const WRONG_PLACE_HINTS = [
  "alaska",
  "austin",
  "texas",
  "california",
  "new york",
  "london",
  "paris",
  "tokyo",
  "singapore",
  "bangkok",
  "sydney",
  "mumbai",
  "delhi",
];

function extractCityFromText(
  text: string,
  destination?: DestinationContext | null,
) {
  if (destination?.city && normalize(text).includes(normalize(destination.city))) {
    return destination.city;
  }
  return null;
}

function normalize(value: string) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function inferNameFromUrl(url: string | null) {
  if (!url) return null;
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
