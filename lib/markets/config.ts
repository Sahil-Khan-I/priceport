import { SUPPORTED_PROXY_COUNTRIES } from "@/lib/tinyfish/config";
import { classifyAccess } from "@/lib/markets/capability";

/**
 * Market contexts for Priceport investigations.
 * Proxy support is limited to documented TinyFish countries only.
 * https://docs.tinyfish.ai/key-concepts/proxies
 */

export const HOME_COUNTRIES = [
  { code: "IN", name: "India", currency: "INR" },
  { code: "AE", name: "United Arab Emirates", currency: "AED" },
  { code: "GB", name: "United Kingdom", currency: "GBP" },
  { code: "DE", name: "Germany", currency: "EUR" },
  { code: "US", name: "United States", currency: "USD" },
  { code: "FR", name: "France", currency: "EUR" },
  { code: "JP", name: "Japan", currency: "JPY" },
  { code: "AU", name: "Australia", currency: "AUD" },
];

export const COMPARISON_CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED"];

export const INVESTIGATION_MARKETS = [
  {
    code: "IN",
    name: "India",
    currency: "INR",
    proxySupported: false,
    storefrontAvailable: true,
    defaultAccessMethod: "storefront",
    note: "TinyFish proxy does not document India. Regional storefront investigation only — not a local IP investigation.",
  },
  {
    code: "AE",
    name: "United Arab Emirates",
    currency: "AED",
    proxySupported: false,
    storefrontAvailable: true,
    defaultAccessMethod: "storefront",
    note: "TinyFish proxy does not document UAE. Regional storefront investigation only — not a local IP investigation.",
  },
  {
    code: "GB",
    name: "United Kingdom",
    currency: "GBP",
    proxySupported: true,
    storefrontAvailable: true,
    defaultAccessMethod: "proxy",
    note: "TinyFish proxy GB is documented.",
  },
  {
    code: "DE",
    name: "Germany",
    currency: "EUR",
    proxySupported: true,
    storefrontAvailable: true,
    defaultAccessMethod: "proxy",
    note: "TinyFish proxy DE is documented.",
  },
  {
    code: "US",
    name: "United States",
    currency: "USD",
    proxySupported: true,
    storefrontAvailable: true,
    defaultAccessMethod: "proxy",
    note: "TinyFish proxy US is documented.",
  },
  {
    code: "FR",
    name: "France",
    currency: "EUR",
    proxySupported: true,
    storefrontAvailable: true,
    defaultAccessMethod: "proxy",
    note: "TinyFish proxy FR is documented.",
  },
  {
    code: "JP",
    name: "Japan",
    currency: "JPY",
    proxySupported: true,
    storefrontAvailable: true,
    defaultAccessMethod: "proxy",
    note: "TinyFish proxy JP is documented.",
  },
  {
    code: "AU",
    name: "Australia",
    currency: "AUD",
    proxySupported: true,
    storefrontAvailable: true,
    defaultAccessMethod: "proxy",
    note: "TinyFish proxy AU is documented.",
  },
  {
    code: "CA",
    name: "Canada",
    currency: "CAD",
    proxySupported: true,
    storefrontAvailable: true,
    defaultAccessMethod: "proxy",
    note: "TinyFish proxy CA is documented.",
  },
  {
    code: "KR",
    name: "South Korea",
    currency: "KRW",
    region: "East Asia",
    proxySupported: false,
    storefrontAvailable: true,
    defaultAccessMethod: "storefront",
    note: "No documented residential proxy for KR. This is a regional storefront check, not a Korean IP.",
  },
  {
    code: "HK",
    name: "Hong Kong",
    currency: "HKD",
    region: "East Asia",
    proxySupported: false,
    storefrontAvailable: true,
    defaultAccessMethod: "storefront",
    note: "No documented residential proxy for HK. This is a regional storefront check, not a Hong Kong IP.",
  },
  {
    code: "TW",
    name: "Taiwan",
    currency: "TWD",
    region: "East Asia",
    proxySupported: false,
    storefrontAvailable: true,
    defaultAccessMethod: "storefront",
    note: "No documented residential proxy for TW. This is a regional storefront check, not a Taiwan IP.",
  },
  {
    code: "SG",
    name: "Singapore",
    currency: "SGD",
    region: "East Asia",
    proxySupported: false,
    storefrontAvailable: true,
    defaultAccessMethod: "storefront",
    note: "No documented residential proxy for SG. This is a regional storefront check, not a Singapore IP.",
  },
  {
    code: "TH",
    name: "Thailand",
    currency: "THB",
    region: "Southeast Asia",
    proxySupported: false,
    storefrontAvailable: true,
    defaultAccessMethod: "storefront",
    note: "No documented residential proxy for TH. This is a regional storefront check, not a Thai IP.",
  },
  {
    code: "MY",
    name: "Malaysia",
    currency: "MYR",
    region: "Southeast Asia",
    proxySupported: false,
    storefrontAvailable: true,
    defaultAccessMethod: "storefront",
    note: "No documented residential proxy for MY. This is a regional storefront check, not a Malaysian IP.",
  },
  {
    code: "CN",
    name: "China",
    currency: "CNY",
    region: "East Asia",
    proxySupported: false,
    storefrontAvailable: false,
    defaultAccessMethod: "unsupported",
    note: "No documented residential proxy for CN, and a China storefront check is not verified.",
  },
];

export const MARKET_REGIONS: Record<string, string> = {
  IN: "South Asia",
  AE: "Middle East",
  GB: "Europe",
  DE: "Europe",
  FR: "Europe",
  US: "Americas",
  CA: "Americas",
  JP: "East Asia",
  AU: "Oceania",
};

export function marketRegion(code: string) {
  const market = getMarket(code) as { region?: string } | null;
  return market?.region || MARKET_REGIONS[code] || "Other";
}

export function getMarket(code) {
  return INVESTIGATION_MARKETS.find((m) => m.code === code) || null;
}

export function resolveMarketAccess(
  marketCode: string,
  preferredMethod: string | null = null,
) {
  const market = getMarket(marketCode);
  if (!market) {
    return {
      selected_market: marketCode,
      actual_proxy_country: null,
      storefront_region: null,
      currency: "",
      access_method: "unsupported",
      access_verified: false,
      enabled: false,
      reason: `Unknown market: ${marketCode}`,
    };
  }

  const requested =
    preferredMethod ||
    (market.proxySupported ? "proxy" : market.storefrontAvailable ? "storefront" : "unsupported");
  const access = classifyAccess(
    {
      code: market.code,
      name: market.name,
      proxySupported: market.proxySupported,
      storefrontAvailable: market.storefrontAvailable,
      requested,
    },
    SUPPORTED_PROXY_COUNTRIES,
  );

  return {
    selected_market: market.code,
    actual_proxy_country: access.actualProxyCountry,
    storefront_region: access.enabled ? market.code : null,
    currency: market.currency,
    access_method: access.accessMethod,
    access_verified: false,
    enabled: access.enabled,
    label: access.label,
    reason: access.enabled
      ? access.accessMethod === "storefront"
        ? "Regional storefront investigation — not labelled as a local IP investigation."
        : null
      : market.note,
  };
}
