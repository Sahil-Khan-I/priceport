/**
 * Destination shortcuts + searchable catalog.
 * Navigation suggestions only — not live hotel inventory.
 */

export type Destination = {
  id: string;
  city: string;
  country: string;
  countryCode: string;
  label: string;
  flag: string;
  searchHint: string;
};

export const POPULAR_DESTINATIONS: Destination[] = [
  dest("dubai", "Dubai", "United Arab Emirates", "AE", "🇦🇪"),
  dest("singapore", "Singapore", "Singapore", "SG", "🇸🇬"),
  dest("london", "London", "United Kingdom", "GB", "🇬🇧"),
  dest("bangkok", "Bangkok", "Thailand", "TH", "🇹🇭"),
  dest("bali", "Bali", "Indonesia", "ID", "🇮🇩"),
  dest("paris", "Paris", "France", "FR", "🇫🇷"),
  dest("tokyo", "Tokyo", "Japan", "JP", "🇯🇵"),
  dest("bengaluru", "Bengaluru", "India", "IN", "🇮🇳"),
];

/** Broader searchable catalog (still curated, not exhaustive world coverage). */
export const DESTINATION_CATALOG: Destination[] = [
  ...POPULAR_DESTINATIONS,
  dest("abu-dhabi", "Abu Dhabi", "United Arab Emirates", "AE", "🇦🇪"),
  dest("new-york", "New York", "United States", "US", "🇺🇸"),
  dest("los-angeles", "Los Angeles", "United States", "US", "🇺🇸"),
  dest("san-francisco", "San Francisco", "United States", "US", "🇺🇸"),
  dest("miami", "Miami", "United States", "US", "🇺🇸"),
  dest("sydney", "Sydney", "Australia", "AU", "🇦🇺"),
  dest("melbourne", "Melbourne", "Australia", "AU", "🇦🇺"),
  dest("berlin", "Berlin", "Germany", "DE", "🇩🇪"),
  dest("munich", "Munich", "Germany", "DE", "🇩🇪"),
  dest("amsterdam", "Amsterdam", "Netherlands", "NL", "🇳🇱"),
  dest("rome", "Rome", "Italy", "IT", "🇮🇹"),
  dest("milan", "Milan", "Italy", "IT", "🇮🇹"),
  dest("barcelona", "Barcelona", "Spain", "ES", "🇪🇸"),
  dest("madrid", "Madrid", "Spain", "ES", "🇪🇸"),
  dest("lisbon", "Lisbon", "Portugal", "PT", "🇵🇹"),
  dest("istanbul", "Istanbul", "Turkey", "TR", "🇹🇷"),
  dest("doha", "Doha", "Qatar", "QA", "🇶🇦"),
  dest("hong-kong", "Hong Kong", "Hong Kong", "HK", "🇭🇰"),
  dest("seoul", "Seoul", "South Korea", "KR", "🇰🇷"),
  dest("mumbai", "Mumbai", "India", "IN", "🇮🇳"),
  dest("delhi", "New Delhi", "India", "IN", "🇮🇳"),
  dest("goa", "Goa", "India", "IN", "🇮🇳"),
  dest("maldives", "Malé", "Maldives", "MV", "🇲🇻"),
  dest("phuket", "Phuket", "Thailand", "TH", "🇹🇭"),
  dest("seoul-busan", "Busan", "South Korea", "KR", "🇰🇷"),
  dest("toronto", "Toronto", "Canada", "CA", "🇨🇦"),
  dest("vancouver", "Vancouver", "Canada", "CA", "🇨🇦"),
  dest("zurich", "Zurich", "Switzerland", "CH", "🇨🇭"),
  dest("vienna", "Vienna", "Austria", "AT", "🇦🇹"),
];

function dest(
  id: string,
  city: string,
  country: string,
  countryCode: string,
  flag: string,
): Destination {
  return {
    id,
    city,
    country,
    countryCode,
    label: `${city}, ${countryCode === "AE" ? "UAE" : countryCode === "GB" ? "UK" : countryCode === "US" ? "USA" : country}`,
    flag,
    searchHint: city,
  };
}

export function searchDestinations(query: string, limit = 8): Destination[] {
  const q = String(query || "")
    .toLowerCase()
    .trim();
  const source = q ? DESTINATION_CATALOG : POPULAR_DESTINATIONS;
  if (!q) return source.slice(0, limit);

  const scored = source
    .map((d) => {
      const hay = `${d.city} ${d.country} ${d.label} ${d.searchHint} ${d.countryCode}`.toLowerCase();
      let score = 0;
      if (d.city.toLowerCase() === q) score += 100;
      else if (d.city.toLowerCase().startsWith(q)) score += 80;
      else if (hay.includes(q)) score += 40;
      else return null;
      return { d, score };
    })
    .filter(Boolean) as Array<{ d: Destination; score: number }>;

  const seen = new Set<string>();
  const out: Destination[] = [];
  for (const row of scored.sort((a, b) => b.score - a.score)) {
    if (seen.has(row.d.id)) continue;
    seen.add(row.d.id);
    out.push(row.d);
    if (out.length >= limit) break;
  }
  return out;
}
