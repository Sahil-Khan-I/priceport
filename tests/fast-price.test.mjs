import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { OFFER_OUTPUT_SCHEMA } from "../lib/offers/schema.ts";
import { classifyComparison } from "../lib/hotels/matching.ts";
import { interpretPrice } from "../lib/pricing/price-basis.ts";
import { calculateSavings } from "../lib/pricing/savings.ts";

const goal = readFileSync(new URL("../lib/providers/fast-goal.ts", import.meta.url), "utf8");

describe("fast extraction goal", () => {
  it("asks only for the hotel, room and price", () => {
    assert.match(goal, /Stop as soon as you have it/);
    assert.match(goal, /Do not read reviews/);
    assert.match(goal, /Do not substitute a cheaper room/);
    assert.doesNotMatch(goal, /cancellation policy/);
    assert.doesNotMatch(goal, /meal plan/);
  });
});

describe("minimal schema", () => {
  it("requires hotel identity and availability, and prices stay optional", () => {
    assert.deepEqual(OFFER_OUTPUT_SCHEMA.required, ["hotelName", "propertyMatch", "availability"]);
    assert.equal(OFFER_OUTPUT_SCHEMA.properties.displayedPrice.type, "number");
    assert.equal(OFFER_OUTPUT_SCHEMA.properties.taxes, undefined);
    assert.ok(OFFER_OUTPUT_SCHEMA.properties.priceBasis.enum.includes("unknown"));
  });
});

describe("strict room comparison", () => {
  it("marks the requested room unavailable", () => {
    const result = classifyComparison({
      preferences: { category: "deluxe" },
      roomType: null,
      availability: "unavailable",
    });
    assert.equal(result.status, "room_unavailable");
  });

  it("does not treat a missing room name as a match", () => {
    const result = classifyComparison({
      preferences: { category: "deluxe" },
      roomType: null,
      availability: "available",
    });
    assert.equal(result.status, "insufficient_data");
  });

  it("keeps a different bed as a partial match of the same category", () => {
    const result = classifyComparison({
      preferences: { category: "deluxe", bedType: "king" },
      roomType: "Deluxe Queen Room",
      bedConfiguration: "Queen",
      availability: "available",
    });
    assert.equal(result.status, "partially_comparable");
  });
});

describe("displayed price comparison", () => {
  it("keeps a nightly amount out of the stay total", () => {
    const price = interpretPrice({ priceBasis: "per_night", nightlyPrice: 185, nights: 3, rooms: 1 });
    assert.equal(price.stayTotal, null);
    assert.equal(price.estimatedStayTotal, 555);
  });

  it("does not save across nightly and total-stay prices", () => {
    const offer = (id, amount, priceBasis) => ({
      id,
      roomType: "Deluxe King",
      propertyMatch: "exact",
      comparisonClass: "exact_match",
      priceBasis,
      comparable: true,
      trueCost: { fullyComparable: false },
      conversion: { available: true, amount, source: "fx" },
    });
    const result = calculateSavings([
      offer("night", 185, "per_night"),
      offer("stay", 555, "total_stay"),
    ]);
    assert.equal(result.headline, null);
  });

  it("compares two displayed stay prices for the same room without a fee breakdown", () => {
    const result = calculateSavings([
      {
        id: "a",
        roomType: "Deluxe King",
        propertyMatch: "exact",
        comparisonClass: "exact_match",
        priceBasis: "total_stay",
        comparable: true,
        trueCost: { fullyComparable: false },
        conversion: { available: true, amount: 500, source: "fx" },
      },
      {
        id: "b",
        roomType: "Deluxe King",
        propertyMatch: "exact",
        comparisonClass: "exact_match",
        priceBasis: "total_stay",
        comparable: true,
        trueCost: { fullyComparable: false },
        conversion: { available: true, amount: 640, source: "fx" },
      },
    ]);
    assert.equal(result.headline.savings, 140);
  });
});
