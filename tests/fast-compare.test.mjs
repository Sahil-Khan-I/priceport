import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  expandPairs,
  filterNewPairs,
  pairKey,
} from "../lib/investigations/job-plan.ts";
import {
  clearDiscoveryCache,
  discoveryCacheKey,
  readDiscoveryCache,
  writeDiscoveryCache,
} from "../lib/hotels/discovery-cache.ts";
import {
  collapseActivity,
  describeEvent,
} from "../lib/investigations/live-view.ts";

describe("job plan", () => {
  it("does not recreate provider-market pairs", () => {
    const existing = [
      { provider: "booking", market: "GB" },
      { provider: "agoda", market: "US" },
    ];
    const incoming = [
      { provider: "booking", market: "GB" },
      { provider: "expedia", market: "US" },
      { provider: "Booking", market: "gb" },
    ];
    const next = filterNewPairs(existing, incoming);
    assert.deepEqual(next, [{ provider: "expedia", market: "US" }]);
    assert.equal(pairKey("Booking", "gb"), "booking|GB");
  });

  it("expands with new providers and one extra market only", () => {
    const added = expandPairs({
      currentProviders: ["booking", "agoda"],
      currentMarkets: ["GB", "US"],
      extraProviders: ["expedia"],
      extraMarkets: ["DE"],
    });
    const keys = added.map((pair) => pairKey(pair.provider, pair.market));
    assert.ok(keys.includes("expedia|GB"));
    assert.ok(keys.includes("expedia|US"));
    assert.ok(keys.includes("booking|DE"));
    assert.ok(keys.includes("agoda|DE"));
    assert.ok(keys.includes("expedia|DE"));
    assert.equal(keys.filter((key) => key === "booking|GB").length, 0);
    assert.equal(added.length, 5);
  });
});

describe("discovery cache keys", () => {
  it("isolates the same hotel name across destinations", () => {
    const dubai = discoveryCacheKey({
      query: "Atlantis",
      city: "Dubai",
      country: "United Arab Emirates",
      countryCode: "AE",
    });
    const singapore = discoveryCacheKey({
      query: "Atlantis",
      city: "Singapore",
      country: "Singapore",
      countryCode: "SG",
    });
    assert.notEqual(dubai, singapore);
    clearDiscoveryCache();
    writeDiscoveryCache(dubai, { results: ["dubai-only"] });
    assert.deepEqual(readDiscoveryCache(dubai), { results: ["dubai-only"] });
    assert.equal(readDiscoveryCache(singapore), null);
    clearDiscoveryCache();
  });
});

describe("activity milestones", () => {
  it("collapses click-level progress into one opening update", () => {
    const jobs = [{ id: "a", providerName: "Booking.com", market: "GB" }];
    const lines = [
      "Click search",
      "Type hotel name",
      "Dismiss cookie banner",
      "Navigate to property page",
    ].map((message, index) => ({
      id: String(index),
      text: describeEvent(
        { id: String(index), type: "PROGRESS", message, jobId: "a" },
        jobs,
      ),
    }));
    const collapsed = collapseActivity(lines);
    assert.ok(collapsed.length <= 3);
    assert.ok(collapsed.every((line) => !/cookie banner|Click search/i.test(line.text)));
    assert.ok(collapsed.some((line) => /opening the provider|searching for the property/.test(line.text)));
  });
});
