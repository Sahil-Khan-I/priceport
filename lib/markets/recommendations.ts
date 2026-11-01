import {
  HOME_COUNTRIES,
  INVESTIGATION_MARKETS,
  getMarket,
  resolveMarketAccess,
} from "@/lib/markets/config";

const FLAG_BY_CODE: Record<string, string> = {
  IN: "🇮🇳",
  AE: "🇦🇪",
  GB: "🇬🇧",
  DE: "🇩🇪",
  US: "🇺🇸",
  FR: "🇫🇷",
  JP: "🇯🇵",
  AU: "🇦🇺",
  CA: "🇨🇦",
  KR: "🇰🇷",
  HK: "🇭🇰",
  TW: "🇹🇼",
  SG: "🇸🇬",
  TH: "🇹🇭",
  MY: "🇲🇾",
  CN: "🇨🇳",
  ID: "🇮🇩",
};

export function countryFlag(code: string) {
  return FLAG_BY_CODE[String(code || "").toUpperCase()] || "🌍";
}

export function currencyForHomeCountry(code: string) {
  const row = HOME_COUNTRIES.find((c) => c.code === code);
  return row?.currency || "USD";
}

/**
 * Suggest comparison markets from real INVESTIGATION_MARKETS config.
 * Never invents unsupported proxy access.
 */
export function recommendMarkets({
  homeCountry,
  destinationCountryCode,
}: {
  homeCountry?: string | null;
  destinationCountryCode?: string | null;
}) {
  const reasons: string[] = [];
  const selected: string[] = [];

  const proxyMarkets = INVESTIGATION_MARKETS.filter((m) => m.proxySupported).map(
    (m) => m.code,
  );

  // Default is a short proxy comparison (~2 markets × 2–3 providers).
  // Storefront-only markets stay available to add manually — they are not silent proxy jobs.
  if (homeCountry && proxyMarkets.includes(homeCountry)) {
    selected.push(homeCountry);
    reasons.push(`Includes your home proxy market (${homeCountry})`);
  }

  if (
    destinationCountryCode &&
    proxyMarkets.includes(destinationCountryCode) &&
    !selected.includes(destinationCountryCode)
  ) {
    selected.push(destinationCountryCode);
    reasons.push(
      `Includes destination proxy market (${destinationCountryCode})`,
    );
  }

  for (const code of ["GB", "US", "DE"]) {
    if (selected.length >= 2) break;
    if (proxyMarkets.includes(code) && !selected.includes(code)) {
      selected.push(code);
    }
  }

  if (homeCountry && getMarket(homeCountry) && !proxyMarkets.includes(homeCountry)) {
    reasons.push(
      `${homeCountry} is storefront-only — add it in Market Lens if you want that perspective; it is not a local-IP proxy`,
    );
  }
  if (
    destinationCountryCode &&
    getMarket(destinationCountryCode) &&
    !proxyMarkets.includes(destinationCountryCode)
  ) {
    reasons.push(
      `${destinationCountryCode} is storefront-only and left out of the default set`,
    );
  }

  reasons.push(
    "Default stays small so an ordinary search is about 4–6 live investigations. Expand markets if you want more.",
  );

  const recommended = selected.slice(0, 2);

  return {
    recommended,
    allProxyCodes: proxyMarkets,
    reasons,
  };
}

export function previewInvestigationJobs({
  providers,
  markets,
  marketAccess = {},
  hotel,
}: {
  providers: string[];
  markets: string[];
  marketAccess?: Record<string, string>;
  hotel?: { officialWebsite?: string | null; providerUrl?: string | null } | null;
}) {
  let executable = 0;
  let unsupported = 0;
  const notes: string[] = [];

  for (const providerId of providers) {
    for (const marketCode of markets) {
      const market = getMarket(marketCode);
      const preferred =
        marketAccess[marketCode] ||
        (market?.proxySupported ? "proxy" : "storefront");
      const access = resolveMarketAccess(marketCode, preferred);

      if (providerId === "official") {
        const hasOfficial =
          Boolean(hotel?.officialWebsite) || Boolean(hotel?.providerUrl);
        if (!hasOfficial) {
          unsupported += 1;
          notes.push(
            "Official website needs a property URL from discovery — otherwise that job is unsupported",
          );
          continue;
        }
      }

      if (access.enabled) executable += 1;
      else {
        unsupported += 1;
        if (access.reason) notes.push(access.reason);
      }
    }
  }

  return {
    executable,
    unsupported,
    totalCombinations: providers.length * markets.length,
    notes: [...new Set(notes)].slice(0, 4),
  };
}

export function inferLocaleHomeCountry() {
  if (typeof navigator === "undefined") return "IN";
  const locale = navigator.language || "";
  const region = locale.split("-")[1]?.toUpperCase();
  if (region && HOME_COUNTRIES.some((c) => c.code === region)) return region;
  if (locale.toLowerCase().startsWith("en-gb")) return "GB";
  if (locale.toLowerCase().startsWith("en-us")) return "US";
  if (locale.toLowerCase().startsWith("de")) return "DE";
  if (locale.toLowerCase().startsWith("fr")) return "FR";
  if (locale.toLowerCase().startsWith("ja")) return "JP";
  if (
    locale.toLowerCase().startsWith("hi") ||
    locale.toLowerCase().startsWith("en-in")
  ) {
    return "IN";
  }
  return "IN";
}

export { FLAG_BY_CODE };
