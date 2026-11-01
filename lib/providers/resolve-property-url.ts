import { getProviderAdapter } from "@/lib/providers/provider-registry";
import { firstPropertyUrlFromSearch, pickDirectPropertyUrl } from "@/lib/providers/property-url";
import { searchProviders } from "@/lib/tinyfish/search";

const CACHE = new Map<string, { url: string; at: number }>();
const TTL_MS = 10 * 60 * 1000;

/** Resolve a direct property page before the browser job starts. Failures stay unresolved. */
export async function resolveProviderPropertyUrls(
  hotel: any,
  providerIds: string[] = [],
) {
  const providerUrls = { ...(hotel?.providerUrls || {}) };
  await Promise.all(
    providerIds.map(async (providerId) => {
      const adapter = getProviderAdapter(providerId);
      const domains = adapter?.domains || [];
      if (!domains.length || !hotel?.name) return;
      if (pickDirectPropertyUrl({ ...hotel, providerUrls }, domains, providerId)) return;
      const cacheKey = `${providerId}|${String(hotel.name).toLowerCase()}|${String(hotel.location || "").toLowerCase()}`;
      const cached = CACHE.get(cacheKey);
      if (cached && Date.now() - cached.at < TTL_MS) {
        providerUrls[providerId] = cached.url;
        return;
      }
      try {
        const result = await Promise.race([
          searchProviders({
            query: `"${hotel.name}" ${hotel.location || ""} site:${domains[0]}`,
            location: "US",
          }),
          new Promise((_, reject) => {
            setTimeout(() => reject(new Error("Property URL lookup timed out")), 8000);
          }),
        ]);
        const found = firstPropertyUrlFromSearch(result, domains);
        if (!found) return;
        providerUrls[providerId] = found;
        CACHE.set(cacheKey, { url: found, at: Date.now() });
      } catch {
        // The provider job will use a dated search URL and must not invent a property page.
      }
    }),
  );
  return { ...hotel, providerUrls };
}
