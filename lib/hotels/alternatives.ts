/**
 * Alternative property discovery via TinyFish Search.
 * Never invent ratings or amenities — only return sourced search hits.
 */

import { searchProviders } from "@/lib/tinyfish/search";
import { isTinyFishConfigured } from "@/lib/tinyfish/config";

export async function discoverAlternativeHotels({
  hotelName,
  location,
  checkIn,
  checkOut,
  limit = 5,
}: {
  hotelName: string;
  location?: string | null;
  checkIn?: string;
  checkOut?: string;
  limit?: number;
}) {
  if (!isTinyFishConfigured()) {
    return {
      ok: false,
      alternatives: [],
      error: "TinyFish is not configured",
    };
  }

  const destination = location || "destination";
  const dates =
    checkIn && checkOut ? ` for stays ${checkIn} to ${checkOut}` : "";
  const query = `hotels near ${hotelName} in ${destination} alternatives to ${hotelName}${dates}`;

  try {
    const result = await searchProviders({
      query,
      location: "US",
    });

    const results = Array.isArray((result as any)?.results)
      ? (result as any).results
      : Array.isArray(result)
        ? result
        : [];

    const alternatives = results
      .map((item: any, index: number) => {
        const title = String(item.title || item.name || "").trim();
        const url = String(item.url || item.link || "").trim();
        const snippet = String(item.snippet || item.description || "").trim();
        if (!title || !url) return null;
        // Skip obvious same-property hits by exact title containment of original.
        if (
          normalize(title) === normalize(hotelName) ||
          normalize(title).includes(normalize(hotelName))
        ) {
          return null;
        }
        return {
          id: `alt_${index}_${hash(url)}`,
          name: title,
          location: destination,
          url,
          snippet: snippet || null,
          source: "tinyfish_search",
          note: "Discovered via TinyFish Search — not price-verified until investigated",
        };
      })
      .filter(Boolean)
      .slice(0, limit);

    return {
      ok: true,
      query,
      alternatives,
      error: null,
    };
  } catch (error) {
    return {
      ok: false,
      alternatives: [],
      error: error instanceof Error ? error.message : "Alternative discovery failed",
    };
  }
}

function normalize(value: string) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hash(value: string) {
  let h = 0;
  for (let i = 0; i < value.length; i += 1) {
    h = (h * 31 + value.charCodeAt(i)) >>> 0;
  }
  return h.toString(36).slice(0, 8);
}
