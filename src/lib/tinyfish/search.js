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
}) {
  try {
    const client = getTinyFishClient();
    return await client.search.query({
      query,
      location,
      language,
      domain_type: domainType,
    });
  } catch (error) {
    throw toTinyFishError(error);
  }
}

export async function discoverHotelProviders(destination, location = "US") {
  return searchProviders({
    query: `hotel booking sites for ${destination}`,
    location,
  });
}
