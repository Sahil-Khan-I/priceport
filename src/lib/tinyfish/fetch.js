import { getTinyFishClient } from "./client";
import { toTinyFishError } from "./errors";

/**
 * TinyFetch — lightweight extraction when a known URL does not need a full agent.
 * Complements TinyAgent; does not replace interactive investigations.
 * SDK: client.fetch.getContents({ urls, ttl? })
 */
export async function fetchPageContents(urls, options = {}) {
  const list = Array.isArray(urls) ? urls : [urls];

  try {
    const client = getTinyFishClient();
    return await client.fetch.getContents({
      urls: list,
      ...(options.ttl !== undefined ? { ttl: options.ttl } : {}),
    });
  } catch (error) {
    throw toTinyFishError(error);
  }
}
