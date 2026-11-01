import { getTinyFishClient } from "./client";
import { toTinyFishError } from "./errors";

/**
 * TinySearch — discover providers, storefronts, and relevant pages.
 * SDK: client.search.query({ query, location, language, ... })
 */
export async function searchProviders({
  query,
  location = "US",
  language = "en",
  domainType = "web",
  purpose,
}: {
  query: string;
  location?: string;
  language?: string;
  domainType?: "web" | "news" | "research_paper";
  purpose?: string;
}) {
  try {
    const client = getTinyFishClient();
    return await client.search.query({
      query,
      location,
      language,
      domain_type: domainType,
      ...(purpose ? { purpose: purpose.slice(0, 2000) } : {}),
    } as any);
  } catch (error) {
    throw toTinyFishError(error);
  }
}

export async function discoverHotelProviders(
  destination: string,
  location = "US",
) {
  return searchProviders({
    query: `hotel booking sites for ${destination}`,
    location,
  });
}
