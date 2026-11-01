import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { classifyComparison } from "../lib/hotels/matching.ts";
import { interpretPrice } from "../lib/pricing/price-basis.ts";
import { calculateSavings } from "../lib/pricing/savings.ts";
import { resolveStreamOutcome, planRetries } from "../lib/investigations/lifecycle.ts";
import {
  normalizeRoomPreferences,
  roomPreferenceGoalLines,
  validateGuestCounts,
} from "../lib/search/room-preferences.ts";

describe("room preference validation", () => {
  it("defaults to any when preferences are omitted", () => {
    const parsed = normalizeRoomPreferences(undefined);
    assert.equal(parsed.ok, true);
    assert.equal(parsed.value.category, null);
    assert.equal(parsed.value.mealPlan, null);
    assert.equal(parsed.value.bedType, null);
  });

  it("keeps a requested deluxe king room", () => {
    const parsed = normalizeRoomPreferences({
      category: "deluxe",
      bedType: "king",
      mealPlan: "breakfast",
    });
    assert.equal(parsed.ok, true);
    assert.equal(parsed.value.category, "deluxe");
    assert.equal(parsed.value.bedType, "king");
  });

  it("rejects an unknown category and invalid child ages", () => {
    const parsed = normalizeRoomPreferences({ category: "penthouse" });
    assert.equal(parsed.ok, false);
    const guests = validateGuestCounts({
      adults: 2,
      children: 1,
      childrenAges: [21],
      rooms: 1,
    });
    assert.ok(guests.some((error) => /childrenAges/.test(error)));
  });

  it("rejects more rooms than adults", () => {
    const guests = validateGuestCounts({
      adults: 1,
      children: 0,
      childrenAges: [],
      rooms: 3,
    });
    assert.ok(guests.some((error) => /rooms cannot exceed adults/.test(error)));
  });
});

describe("room comparison", () => {
  const prefs = { category: "deluxe", bedType: "king", mealPlan: "breakfast" };

  it("treats deluxe king wording as an exact match", () => {
    const result = classifyComparison({
      preferences: prefs,
      roomType: "Deluxe Room with King Bed",
      bedConfiguration: "King",
      mealPlan: "Breakfast included",
      mealPlanStatus: "breakfast_included",
      cancellationStatus: "refundable",
    });
    assert.equal(result.status, "exact_match");
  });

  it("rejects a standard twin room", () => {
    const result = classifyComparison({
      preferences: prefs,
      roomType: "Standard Twin Room",
      bedConfiguration: "Twin",
      mealPlan: "Room only",
      mealPlanStatus: "breakfast_not_included",
      cancellationStatus: "refundable",
    });
    assert.equal(result.status, "not_comparable");
  });

  it("accepts any room without calling it an exact match", () => {
    const result = classifyComparison({
      preferences: {},
      roomType: "Superior Double Room",
      mealPlanStatus: "unknown",
      cancellationStatus: "unknown",
    });
    assert.equal(result.status, "comparable");
  });

  it("does not compare different stay dates", () => {
    const result = classifyComparison({
      preferences: {},
      roomType: "Deluxe King",
      stayDifferences: ["checkIn differs"],
    });
    assert.equal(result.status, "not_comparable");
  });
});

describe("price basis", () => {
  it("does not treat a nightly figure as the stay total", () => {
    const price = interpretPrice({
      priceBasis: "per_night",
      totalPrice: 554,
      nights: 3,
      rooms: 1,
    });
    assert.equal(price.stayTotal, null);
    assert.equal(price.nightlyPrice, 554);
    assert.equal(price.estimatedStayTotal, 1662);
  });

  it("keeps an explicit stay total", () => {
    const price = interpretPrice({
      priceBasis: "total_stay",
      totalPrice: 10688,
      currency: "INR",
    });
    assert.equal(price.stayTotal, 10688);
  });

  it("does not invent a stay total when the basis is unknown", () => {
    const price = interpretPrice({ totalPrice: 554 });
    assert.equal(price.priceBasis, "unknown");
    assert.equal(price.stayTotal, null);
    assert.equal(price.displayedUnscoped, 554);
  });
});

describe("savings exclusions", () => {
  it("excludes nightly prices from savings", () => {
    const result = calculateSavings([
      {
        id: "a",
        roomType: "Deluxe King",
        mealPlanStatus: "breakfast_included",
        cancellationStatus: "refundable",
        propertyMatch: "exact",
        comparisonClass: "exact_match",
        priceBasis: "per_night",
        comparable: true,
        trueCost: { fullyComparable: true, confirmedTotal: 554 },
        conversion: { available: true, amount: 554, source: "fx" },
      },
      {
        id: "b",
        roomType: "Deluxe King",
        mealPlanStatus: "breakfast_included",
        cancellationStatus: "refundable",
        propertyMatch: "exact",
        comparisonClass: "exact_match",
        priceBasis: "total_stay",
        comparable: true,
        trueCost: { fullyComparable: true, confirmedTotal: 1600 },
        conversion: { available: true, amount: 1600, source: "fx" },
      },
    ]);
    assert.equal(result.headline, null);
  });
});

describe("investigation lifecycle", () => {
  it("does not treat a finished browser with no result as completed", () => {
    const outcome = resolveStreamOutcome(null);
    assert.equal(outcome.status, "failed");
    assert.equal(outcome.extractionStatus, "failed");
  });

  it("keeps a failed extraction separate from a completed browser run", () => {
    const outcome = resolveStreamOutcome({ status: "FAILED", error: { message: "blocked" } });
    assert.equal(outcome.status, "failed");
    assert.equal(outcome.browserSessionStatus, "finished");
    assert.match(outcome.error, /blocked/);
  });

  it("retries as a new job and skips an active duplicate", () => {
    const jobs = [
      { id: "old", provider: "agoda", market: "US", stage: "initial", status: "failed", url: "https://agoda.com", goal: "find" },
      { id: "live", provider: "agoda", market: "GB", stage: "initial", status: "navigating", url: "https://agoda.com", goal: "find" },
    ];
    const planned = planRetries(jobs, null);
    assert.equal(planned.length, 1);
    assert.equal(planned[0].replacesJobId, "old");
    assert.equal(planned[0].status, "queued");
    const again = planRetries([
      ...jobs,
      { ...planned[0], id: "new", status: "queued" },
    ], null);
    assert.equal(again.length, 0);
  });
});

describe("goal context", () => {
  it("includes the requested room for the provider goal", () => {
    const lines = roomPreferenceGoalLines({
      category: "deluxe",
      bedType: "king",
      mealPlan: "breakfast",
    });
    assert.match(lines, /Deluxe room/);
    assert.match(lines, /King bed/);
    assert.match(lines, /Breakfast included/);
  });
});
