import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { selectDefaultMarkets } from "../lib/markets/select-markets.ts";
import {
  firstPropertyUrlFromSearch,
  isDirectPropertyUrl,
  pickDirectPropertyUrl,
} from "../lib/providers/property-url.ts";

const markets = [
  { code: "US", name: "United States", proxySupported: true, storefrontAvailable: true },
  { code: "GB", name: "United Kingdom", proxySupported: true, storefrontAvailable: true },
  { code: "IN", name: "India", proxySupported: false, storefrontAvailable: true },
  { code: "AE", name: "United Arab Emirates", proxySupported: false, storefrontAvailable: true },
  { code: "CN", name: "China", proxySupported: false, storefrontAvailable: false },
];

describe("default markets", () => {
  it("keeps a US home market and a Dubai storefront instead of substituting Britain", () => {
    const result = selectDefaultMarkets({
      homeCountry: "US",
      destinationCountryCode: "AE",
      markets,
    });
    assert.deepEqual(result.recommended, ["US", "AE"]);
    assert.ok(result.reasons.some((reason) => /not a local residential IP/i.test(reason)));
    assert.equal(result.recommended.includes("GB"), false);
  });

  it("uses storefront access for an Indian traveller and a Dubai hotel", () => {
    const result = selectDefaultMarkets({
      homeCountry: "IN",
      destinationCountryCode: "AE",
      markets,
    });
    assert.deepEqual(result.recommended, ["IN", "AE"]);
  });

  it("does not add filler countries when only the home market is supported", () => {
    const result = selectDefaultMarkets({
      homeCountry: "US",
      destinationCountryCode: null,
      markets,
    });
    assert.deepEqual(result.recommended, ["US"]);
  });

  it("explains a market with no access method", () => {
    const result = selectDefaultMarkets({
      homeCountry: "CN",
      destinationCountryCode: "AE",
      markets,
    });
    assert.deepEqual(result.recommended, ["AE"]);
    assert.ok(result.reasons.some((reason) => /no supported access method/i.test(reason)));
  });
});

describe("direct property URLs", () => {
  it("accepts a provider property page and rejects search pages and the wrong host", () => {
    assert.equal(
      isDirectPropertyUrl("https://www.booking.com/hotel/ae/atlantis.html", ["booking.com"]),
      true,
    );
    assert.equal(
      isDirectPropertyUrl("https://www.booking.com/searchresults.html?ss=atlantis", ["booking.com"]),
      false,
    );
    assert.equal(
      isDirectPropertyUrl("https://www.booking.com/hotel/ae/atlantis.html", ["agoda.com"]),
      false,
    );
    assert.equal(
      isDirectPropertyUrl("https://www.agoda.com/search?city=dubai", ["agoda.com"]),
      false,
    );
  });

  it("does not send a Booking.com page to Agoda", () => {
    const url = pickDirectPropertyUrl(
      { providerUrl: "https://www.booking.com/hotel/ae/atlantis.html" },
      ["agoda.com"],
      "agoda",
    );
    assert.equal(url, null);
  });

  it("ignores search hits that are not property pages", () => {
    const found = firstPropertyUrlFromSearch(
      {
        results: [
          { url: "https://www.booking.com/searchresults.html?ss=atlantis" },
          { url: "https://www.booking.com/hotel/ae/atlantis.html" },
        ],
      },
      ["booking.com"],
    );
    assert.equal(found, "https://www.booking.com/hotel/ae/atlantis.html");
  });
});
