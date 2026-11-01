import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  classifyRoomMatch,
  classifyMealPlan,
  classifyCancellation,
} from "../lib/hotels/matching.ts";

describe("classifyRoomMatch", () => {
  it("exact match", () => {
    assert.equal(classifyRoomMatch("King Room", "King Room").status, "exact");
  });

  it("unknown when missing", () => {
    assert.equal(classifyRoomMatch(null, "King").status, "unknown");
  });

  it("different rooms", () => {
    assert.equal(
      classifyRoomMatch("Standard Twin", "Presidential Suite").status,
      "different",
    );
  });
});

describe("classifyMealPlan", () => {
  it("breakfast included", () => {
    assert.equal(classifyMealPlan("Breakfast included"), "breakfast_included");
  });

  it("room only", () => {
    assert.equal(classifyMealPlan("Room only"), "breakfast_not_included");
  });

  it("unknown", () => {
    assert.equal(classifyMealPlan(null), "unknown");
  });
});

describe("classifyCancellation", () => {
  it("uses boolean refundable", () => {
    assert.equal(classifyCancellation(null, false), "non_refundable");
    assert.equal(classifyCancellation(null, true), "refundable");
  });

  it("parses policy text", () => {
    assert.equal(
      classifyCancellation("Free cancellation until Dec 1"),
      "refundable",
    );
    assert.equal(classifyCancellation("Non-refundable"), "non_refundable");
  });
});
