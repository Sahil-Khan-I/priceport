export type MarketAccessRow = {
  code: string;
  name?: string;
  proxySupported?: boolean;
  storefrontAvailable?: boolean;
};

/**
 * Default markets are the home country and the hotel destination
 * when either residential proxy or storefront access is configured.
 * Unrelated countries are not added to fill a quota.
 */
export function selectDefaultMarkets({
  homeCountry,
  destinationCountryCode,
  markets,
}: {
  homeCountry?: string | null;
  destinationCountryCode?: string | null;
  markets: MarketAccessRow[];
}) {
  const byCode = new Map(markets.map((market) => [market.code.toUpperCase(), market]));
  const selected: string[] = [];
  const reasons: string[] = [];

  const consider = (code: string | null | undefined, role: string) => {
    const normalized = String(code || "").toUpperCase();
    if (!normalized) return;
    const market = byCode.get(normalized);
    if (!market) {
      reasons.push(`${normalized} is not a configured market.`);
      return;
    }
    if (!market.proxySupported && !market.storefrontAvailable) {
      reasons.push(`${market.name || normalized} has no supported access method.`);
      return;
    }
    if (selected.includes(normalized)) return;
    selected.push(normalized);
    const access = market.proxySupported
      ? "Residential proxy where documented. Not a claim about every visitor IP."
      : "Storefront only. This is not a local residential IP.";
    reasons.push(`${market.name || normalized}: ${access} ${role}`);
  };

  consider(homeCountry, "Included as the home country.");
  consider(destinationCountryCode, "Included as the hotel destination.");

  return {
    recommended: selected,
    allProxyCodes: markets.filter((market) => market.proxySupported).map((market) => market.code),
    reasons,
  };
}
