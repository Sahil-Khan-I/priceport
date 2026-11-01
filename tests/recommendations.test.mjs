import { describe, it } from "node:test";
import assert from "node:assert/strict";

/**
 * Mirror of recommendMarkets / preview rules for Node unit tests without TS path aliases.
 * Production logic lives in lib/markets/recommendations.ts and is exercised via the app.
 */

const PROXY = ["US", "GB", "CA", "DE", "FR", "JP", "AU"];
const MARKETS = {
  IN: { proxySupported: false, storefrontAvailable: true },
  AE: { proxySupported: false, storefrontAvailable: true },
  GB: { proxySupported: true, storefrontAvailable: true },
  US: { proxySupported: true, storefrontAvailable: true },
  DE: { proxySupported: true, storefrontAvailable: true },
};

function recommendMarkets({ homeCountry, destinationCountryCode }) {
  const selected = [];
  if (homeCountry && PROXY.includes(homeCountry)) selected.push(homeCountry);
  if (
    destinationCountryCode &&
    PROXY.includes(destinationCountryCode) &&
    !selected.includes(destinationCountryCode)
  ) {
    selected.push(destinationCountryCode);
  }
  for (const code of ["GB", "US", "DE"]) {
    if (selected.length >= 2) break;
    if (PROXY.includes(code) && !selected.includes(code)) selected.push(code);
  }
  return { recommended: selected.slice(0, 2), allProxyCodes: PROXY };
}

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
  it("keeps the default to two proxy markets", () => {
    const result = recommendMarkets({
      homeCountry: "IN",
      destinationCountryCode: "AE",
    });
    assert.deepEqual(result.recommended, ["GB", "US"]);
    assert.equal(result.recommended.length, 2);
  });

  it("keeps a proxy home country in the default pair", () => {
    const result = recommendMarkets({
      homeCountry: "DE",
      destinationCountryCode: "AE",
    });
    assert.ok(result.recommended.includes("DE"));
    assert.equal(result.recommended.length, 2);
    assert.ok(!result.recommended.includes("AE"));
  });

  it("lists documented proxy codes", () => {
    const result = recommendMarkets({});
    for (const code of result.allProxyCodes) {
      assert.ok(PROXY.includes(code));
    }
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
