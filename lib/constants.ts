/** Documented TinyFish proxy countries — https://docs.tinyfish.ai/key-concepts/proxies */
export const TINYFISH_PROXY_COUNTRIES = [
  { code: "US", name: "United States" },
  { code: "GB", name: "United Kingdom" },
  { code: "CA", name: "Canada" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "JP", name: "Japan" },
  { code: "AU", name: "Australia" },
];

export const TINYFISH_PROXY_CODES = new Set(
  TINYFISH_PROXY_COUNTRIES.map((c) => c.code),
);

export const SITE = {
  name: "Priceport",
  tagline: "Your world. Better priced.",
  title: "Priceport — Your World. Better Priced.",
  description:
    "Investigate global prices with autonomous AI agents. Compare booking providers, discover regional price differences, and find the best deals you can actually book.",
};

export const NAV_LINKS = [
  { href: "/search", label: "Search" },
  { href: "/tracks", label: "Tracks" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#market-lens", label: "Market Lens" },
];

export const PROVIDERS = [
  {
    id: "booking",
    name: "Booking.com",
    searchUrl: "https://www.booking.com",
  },
  {
    id: "agoda",
    name: "Agoda",
    searchUrl: "https://www.agoda.com",
  },
  {
    id: "expedia",
    name: "Expedia",
    searchUrl: "https://www.expedia.com",
  },
  {
    id: "hotel-direct",
    name: "Hotel direct",
    searchUrl: null,
  },
];

/**
 * Market contexts used in product previews.
 * `proxySupported` reflects TinyFish documented proxy_config.country_code values only.
 * Markets without proxy support may still use regional storefront URLs later — never claim IP geo unless verified.
 */
export const MARKET_CONTEXTS = [
  {
    code: "IN",
    name: "India",
    currency: "INR",
    proxySupported: false,
    accessNote: "Regional storefront / unsupported TinyFish proxy",
  },
  {
    code: "AE",
    name: "UAE",
    currency: "AED",
    proxySupported: false,
    accessNote: "Regional storefront / unsupported TinyFish proxy",
  },
  {
    code: "DE",
    name: "Germany",
    currency: "EUR",
    proxySupported: true,
    accessNote: "TinyFish proxy DE",
  },
  {
    code: "GB",
    name: "United Kingdom",
    currency: "GBP",
    proxySupported: true,
    accessNote: "TinyFish proxy GB",
  },
];

export const INVESTIGATION_STATUSES = [
  "queued",
  "starting",
  "navigating",
  "searching",
  "extracting",
  "verifying",
  "completed",
  "failed",
  "timed_out",
  "unsupported",
];

export const CATEGORIES = [
  { id: "hotels", label: "Hotels", status: "live" },
  { id: "flights", label: "Flights", status: "planned" },
  { id: "rentals", label: "Vacation rentals", status: "planned" },
  { id: "electronics", label: "Electronics", status: "planned" },
  { id: "transit", label: "Trains and buses", status: "planned" },
  { id: "subscriptions", label: "Digital subscriptions", status: "planned" },
];

/** Illustrative Market Lens rows — preview data only, not live findings. */
export const MARKET_LENS_PREVIEW_ROWS = [
  {
    provider: "Booking.com",
    country: "Germany",
    countryCode: "DE",
    originalPrice: "€412",
    convertedPrice: "$448",
    currency: "EUR",
    totalCost: "$478",
    availability: "Available",
    eligibility: "Bookable",
    lastChecked: "Preview",
    source: "booking.com/…",
    proxySupported: true,
    highlight: "bookable",
  },
  {
    provider: "Agoda",
    country: "United Kingdom",
    countryCode: "GB",
    originalPrice: "£365",
    convertedPrice: "$462",
    currency: "GBP",
    totalCost: "$491",
    availability: "Available",
    eligibility: "Bookable",
    lastChecked: "Preview",
    source: "agoda.com/…",
    proxySupported: true,
  },
  {
    provider: "Booking.com",
    country: "India",
    countryCode: "IN",
    originalPrice: "₹34,900",
    convertedPrice: "$417",
    currency: "INR",
    totalCost: "$449",
    availability: "Available",
    eligibility: "Eligibility unclear",
    lastChecked: "Preview",
    source: "booking.com/…",
    proxySupported: false,
    highlight: "lowest",
  },
  {
    provider: "Expedia",
    country: "United Kingdom",
    countryCode: "GB",
    originalPrice: "£389",
    convertedPrice: "$492",
    currency: "GBP",
    totalCost: "$521",
    availability: "Limited",
    eligibility: "Bookable",
    lastChecked: "Preview",
    source: "expedia.com/…",
    proxySupported: true,
  },
];

/** Illustrative Investigation Room jobs — product preview, not live TinyFish runs. */
export const INVESTIGATION_PREVIEW_JOBS = [
  {
    id: "job-booking-in",
    provider: "Booking.com",
    market: "India",
    marketCode: "IN",
    status: "extracting",
    progress: 68,
    proxyCountry: null,
    accessMethod: "Regional storefront",
    extracted: "Room rates + taxes visible",
  },
  {
    id: "job-booking-ae",
    provider: "Booking.com",
    market: "UAE",
    marketCode: "AE",
    status: "searching",
    progress: 41,
    proxyCountry: null,
    accessMethod: "Regional storefront",
    extracted: "Searching Dubai stays…",
  },
  {
    id: "job-agoda-de",
    provider: "Agoda",
    market: "Germany",
    marketCode: "DE",
    status: "verifying",
    progress: 86,
    proxyCountry: "DE",
    accessMethod: "TinyFish proxy DE",
    extracted: "€412 · free cancellation",
  },
  {
    id: "job-expedia-gb",
    provider: "Expedia",
    market: "United Kingdom",
    marketCode: "GB",
    status: "completed",
    progress: 100,
    proxyCountry: "GB",
    accessMethod: "TinyFish proxy GB",
    extracted: "£389 · breakfast optional",
  },
];

export const INVESTIGATION_PREVIEW_EVENTS = [
  { time: "0:00", text: "Investigation queued — 4 provider × market jobs" },
  { time: "0:02", text: "Agent started — Booking.com × India" },
  { time: "0:05", text: "Visiting provider search page" },
  { time: "0:11", text: "Searching hotel · Dec 10–13 · 2 adults" },
  { time: "0:18", text: "Extracting room information and displayed price" },
  { time: "0:24", text: "Checking price details and mandatory fees" },
  { time: "0:31", text: "Returning structured findings to Priceport" },
];

export const TRUE_COST_PREVIEW = {
  basePrice: { label: "Base room rate", amount: "$417", kind: "confirmed" },
  fees: [
    { label: "Taxes", amount: "$28", kind: "confirmed" },
    { label: "Service fee", amount: "$12", kind: "estimated" },
    { label: "Resort / city tax", amount: "—", kind: "unknown" },
    { label: "Booking fee", amount: "$0", kind: "confirmed" },
  ],
  totalConfirmed: "$445",
  totalWithEstimates: "$457",
  unknownNote: "Unknown fees are never treated as zero.",
};
