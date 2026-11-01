/**
 * A direct property page is not a homepage, directory, or provider search page.
 */

export function isDirectPropertyUrl(input: unknown, domains: string[] = []) {
  if (!input || typeof input !== "string") return false;
  let parsed: URL;
  try {
    parsed = new URL(input.trim());
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
  const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
  const allowed = domains.map((domain) => domain.toLowerCase().replace(/^www\./, ""));
  if (!allowed.some((domain) => host === domain || host.endsWith(`.${domain}`))) return false;
  const path = parsed.pathname.toLowerCase();
  if (/searchresults|hotel-search|\/search(\/|$|\?)/.test(`${path}${parsed.search.toLowerCase()}`)) {
    return false;
  }
  const depth = path.split("/").filter(Boolean).length;
  if (depth < 2) return false;
  return (
    /\/hotel\//.test(path) ||
    /\/hotels\/[^/]+/.test(path) ||
    (/hotel/.test(path) && /\.html?$/.test(path)) ||
    /hotel-information|\.h\d{3,}/i.test(path)
  );
}

export function pickDirectPropertyUrl(
  hotel: { providerUrl?: string | null; officialWebsite?: string | null; providerUrls?: Record<string, string> | null } | null | undefined,
  domains: string[],
  providerId?: string,
) {
  const candidates = [
    providerId ? hotel?.providerUrls?.[providerId] : null,
    hotel?.providerUrl,
    hotel?.officialWebsite,
  ];
  for (const candidate of candidates) {
    if (isDirectPropertyUrl(candidate, domains)) return String(candidate);
  }
  return null;
}

export function firstPropertyUrlFromSearch(payload: any, domains: string[]) {
  const items = payload?.results || payload?.organic || payload?.items || payload?.data || [];
  if (!Array.isArray(items)) return null;
  for (const item of items) {
    const url = item?.url || item?.link || item?.href;
    if (isDirectPropertyUrl(url, domains)) return String(url);
  }
  return null;
}
