/**
 * Market access is separate from any one proxy vendor.
 * A country is a residential proxy only when that vendor documents it.
 */

export type AccessInput = {
  code: string;
  name?: string;
  proxySupported?: boolean;
  storefrontAvailable?: boolean;
  requested?: string | null;
};

export function classifyAccess(
  market: AccessInput | null,
  documentedProxyCountries: readonly string[],
) {
  if (!market) {
    return {
      enabled: false,
      accessMethod: "unsupported",
      actualProxyCountry: null as string | null,
      label: "Market access unavailable",
    };
  }

  const requested = market.requested || null;
  const wantsProxy =
    requested === "proxy" || (requested == null && market.proxySupported === true);

  if (wantsProxy) {
    if (documentedProxyCountries.includes(market.code)) {
      return {
        enabled: true,
        accessMethod: "proxy",
        actualProxyCountry: market.code,
        label: `Residential proxy · ${market.name || market.code}`,
      };
    }
    return {
      enabled: false,
      accessMethod: "unsupported",
      actualProxyCountry: null,
      label: "Market access unavailable",
    };
  }

  if (requested !== "unsupported" && market.storefrontAvailable) {
    return {
      enabled: true,
      accessMethod: "storefront",
      actualProxyCountry: null,
      label: `Storefront · ${market.name || market.code}`,
    };
  }

  return {
    enabled: false,
    accessMethod: "unsupported",
    actualProxyCountry: null,
    label: "Market access unavailable",
  };
}
