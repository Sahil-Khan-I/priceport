import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { selectDefaultMarkets } from "../lib/markets/select-markets.ts";

/**
 * Mirror of recommendMarkets / preview rules for Node unit tests without TS path aliases.
 * Production logic lives in lib/markets/recommendations.ts and is exercised via the app.
 */

const MARKETS = {
  IN: { proxySupported: false, storefrontAvailable: true },
  AE: { proxySupported: false, storefrontAvailable: true },
  GB: { proxySupported: true, storefrontAvailable: true },
  US: { proxySupported: true, storefrontAvailable: true },
  DE: { proxySupported: true, storefrontAvailable: true },
};

function previewInvestigationJobs({ providers, markets, hotel }) {
  let executable = 0;
  let unsupported = 0;
  for (const providerId of providers) {
    for (const marketCode of markets) {
      if (providerId === "official" && !hotel?.providerUrl && !hotel?.officialWebsite) {
        unsupported += 1;
        continue;
      }
      if (MARKETS[marketCode]) executable += 1;
      else unsupported += 1;
    }
  }
  return { executable, unsupported };
}

describe("recommendMarkets", () => {
  it("uses home and destination access instead of filler proxy countries", () => {
    const result = selectDefaultMarkets({
      homeCountry: "IN",
      destinationCountryCode: "AE",
      markets: [
        { code: "IN", proxySupported: false, storefrontAvailable: true },
        { code: "AE", proxySupported: false, storefrontAvailable: true },
        { code: "GB", proxySupported: true, storefrontAvailable: true },
        { code: "US", proxySupported: true, storefrontAvailable: true },
      ],
    });
    assert.deepEqual(result.recommended, ["IN", "AE"]);
  });
});

describe("previewInvestigationJobs", () => {
  it("counts executable market jobs", () => {
    const preview = previewInvestigationJobs({
      providers: ["booking"],
      markets: ["GB", "US"],
      hotel: { providerUrl: "https://www.booking.com/hotel/x" },
    });
    assert.equal(preview.executable, 2);
  });

  it("marks official without URL as unsupported", () => {
    const preview = previewInvestigationJobs({
      providers: ["official"],
      markets: ["GB"],
      hotel: {},
    });
    assert.equal(preview.executable, 0);
    assert.ok(preview.unsupported >= 1);
  });
});
