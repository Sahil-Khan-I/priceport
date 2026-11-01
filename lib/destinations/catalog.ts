/**
 * Popular destination shortcuts — navigation suggestions only.
 * Not live hotel inventory or availability claims.
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
  {
    id: "dubai",
    city: "Dubai",
    country: "United Arab Emirates",
    countryCode: "AE",
    label: "Dubai, UAE",
    flag: "🇦🇪",
    searchHint: "Dubai",
  },
  {
    id: "singapore",
    city: "Singapore",
    country: "Singapore",
    countryCode: "SG",
    label: "Singapore",
    flag: "🇸🇬",
    searchHint: "Singapore",
  },
  {
    id: "london",
    city: "London",
    country: "United Kingdom",
    countryCode: "GB",
    label: "London, UK",
    flag: "🇬🇧",
    searchHint: "London",
  },
  {
    id: "bangkok",
    city: "Bangkok",
    country: "Thailand",
    countryCode: "TH",
    label: "Bangkok, Thailand",
    flag: "🇹🇭",
    searchHint: "Bangkok",
  },
  {
    id: "bali",
    city: "Bali",
    country: "Indonesia",
    countryCode: "ID",
    label: "Bali, Indonesia",
    flag: "🇮🇩",
    searchHint: "Bali",
  },
  {
    id: "paris",
    city: "Paris",
    country: "France",
    countryCode: "FR",
    label: "Paris, France",
    flag: "🇫🇷",
    searchHint: "Paris",
  },
  {
    id: "tokyo",
    city: "Tokyo",
    country: "Japan",
    countryCode: "JP",
    label: "Tokyo, Japan",
    flag: "🇯🇵",
    searchHint: "Tokyo",
  },
  {
    id: "bengaluru",
    city: "Bengaluru",
    country: "India",
    countryCode: "IN",
    label: "Bengaluru, India",
    flag: "🇮🇳",
    searchHint: "Bengaluru",
  },
  {
    id: "new-york",
    city: "New York",
    country: "United States",
    countryCode: "US",
    label: "New York, USA",
    flag: "🇺🇸",
    searchHint: "New York",
  },
  {
    id: "sydney",
    city: "Sydney",
    country: "Australia",
    countryCode: "AU",
    label: "Sydney, Australia",
    flag: "🇦🇺",
    searchHint: "Sydney",
  },
];

export function searchDestinations(query: string, limit = 8): Destination[] {
  const q = String(query || "")
    .toLowerCase()
    .trim();
  if (!q) return POPULAR_DESTINATIONS.slice(0, limit);
  return POPULAR_DESTINATIONS.filter((d) => {
    const hay = `${d.city} ${d.country} ${d.label} ${d.searchHint}`.toLowerCase();
    return hay.includes(q);
  }).slice(0, limit);
}
