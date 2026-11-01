import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  matchProperty,
  compareRoomConditions,
  compareBookingDetails,
} from "../lib/hotels/matching.ts";

describe("matchProperty", () => {
  it("exact name + matching city => exact", () => {
    const result = matchProperty(
      { name: "Atlantis The Palm", location: "Dubai" },
      { hotelName: "Atlantis, The Palm", propertyAddress: "Dubai, UAE" },
    );
    assert.equal(result.status, "exact");
  });

  it("exact name but different city => unmatched", () => {
    const result = matchProperty(
      { name: "Hilton Metropole", location: "London" },
      { hotelName: "Hilton Metropole", city: "Birmingham" },
    );
    assert.equal(result.status, "unmatched");
    assert.ok(result.reasons.some((r) => /location conflict/i.test(r)));
  });

  it("exact name with missing location => probable, not exact", () => {
    const result = matchProperty(
      { name: "Marina Bay Sands", location: "Singapore" },
      { hotelName: "Marina Bay Sands" },
    );
    assert.equal(result.status, "probable");
    assert.notEqual(result.status, "exact");
  });

  it("similar brand name different property => unmatched or partial", () => {
    const result = matchProperty(
      { name: "The Leela Palace Bengaluru", location: "Bengaluru" },
      { hotelName: "The Leela Palace New Delhi", city: "New Delhi" },
    );
    assert.ok(["unmatched", "partial"].includes(result.status));
  });

  it("partial name with matching city => probable", () => {
    const result = matchProperty(
      { name: "Adlon Kempinski", location: "Berlin" },
      { hotelName: "Hotel Adlon Kempinski Berlin", city: "Berlin" },
    );
    assert.equal(result.status, "probable");
  });

  it("missing names => unknown", () => {
    const result = matchProperty({ location: "Dubai" }, { city: "Dubai" });
    assert.equal(result.status, "unknown");
  });
});

describe("compareRoomConditions", () => {
  it("detects meal plan differences", () => {
    const result = compareRoomConditions(
      { roomType: "King", mealPlan: "Room only", cancellationPolicy: "Non-refundable" },
      {
        roomType: "King",
        mealPlan: "Breakfast included",
        cancellationPolicy: "Free cancellation",
      },
    );
    assert.equal(result.equivalent, false);
    assert.ok(result.differences.length >= 2);
  });

  it("marks unknowns when conditions missing", () => {
    const result = compareRoomConditions(
      { roomType: "King" },
      { roomType: "King", mealPlan: "Breakfast" },
    );
    assert.ok(result.unknowns.length > 0);
    assert.equal(result.equivalent, false);
  });
});

describe("compareBookingDetails", () => {
  it("flags occupancy mismatches", () => {
    const result = compareBookingDetails(
      { checkIn: "2026-12-10", checkOut: "2026-12-13", adults: 2, children: 0, rooms: 1 },
      { checkIn: "2026-12-10", checkOut: "2026-12-13", adults: 3, children: 0, rooms: 1 },
    );
    assert.equal(result.equivalent, false);
  });
});
