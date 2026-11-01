import {
  HOME_COUNTRIES,
  INVESTIGATION_MARKETS,
  getMarket,
  resolveMarketAccess,
} from "@/lib/markets/config";
import { selectDefaultMarkets } from "@/lib/markets/select-markets";

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
  return selectDefaultMarkets({
    homeCountry,
    destinationCountryCode,
    markets: INVESTIGATION_MARKETS.map((market) => ({
      code: market.code,
      name: market.name,
      proxySupported: market.proxySupported,
      storefrontAvailable: market.storefrontAvailable,
    })),
  });
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
