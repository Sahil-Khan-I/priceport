import { SUPPORTED_PROXY_COUNTRIES } from "@/lib/tinyfish/config";

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
];

export function getMarket(code) {
  return INVESTIGATION_MARKETS.find((m) => m.code === code) || null;
}

export function resolveMarketAccess(marketCode, preferredMethod = null) {
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

  const method =
    preferredMethod ||
    (market.proxySupported ? "proxy" : market.storefrontAvailable ? "storefront" : "unsupported");

  if (method === "proxy") {
    const supported = (SUPPORTED_PROXY_COUNTRIES as readonly string[]).includes(
      market.code,
    );
    if (!supported) {
      return {
        selected_market: market.code,
        actual_proxy_country: null,
        storefront_region: null,
        currency: market.currency,
        access_method: "unsupported",
        access_verified: false,
        enabled: false,
        reason: `Actual proxy access for ${market.name} is not currently supported. A regional storefront investigation may be available separately.`,
      };
    }
    return {
      selected_market: market.code,
      actual_proxy_country: market.code,
      storefront_region: market.code,
      currency: market.currency,
      access_method: "proxy",
      access_verified: false,
      enabled: true,
      reason: null,
    };
  }

  if (method === "storefront" && market.storefrontAvailable) {
    return {
      selected_market: market.code,
      actual_proxy_country: null,
      storefront_region: market.code,
      currency: market.currency,
      access_method: "storefront",
      access_verified: false,
      enabled: true,
      reason:
        "Regional storefront investigation — not labelled as a local IP investigation.",
    };
  }

  return {
    selected_market: market.code,
    actual_proxy_country: null,
    storefront_region: null,
    currency: market.currency,
    access_method: "unsupported",
    access_verified: false,
    enabled: false,
    reason: market.note,
  };
}
