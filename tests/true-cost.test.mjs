import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { calculateTrueCost } from "../lib/pricing/true-cost.ts";

describe("calculateTrueCost", () => {
  it("base price only is partial, not confirmed", () => {
    const result = calculateTrueCost({ basePrice: 100 });
    assert.equal(result.totalStatus, "partial");
    assert.equal(result.fullyComparable, false);
    assert.equal(result.confirmedTotal, null);
    assert.equal(result.displayedTotal, 100);
  });

  it("base + confirmed taxes + mandatory fees can be confirmed", () => {
    const result = calculateTrueCost({
      basePrice: 100,
      taxes: 12,
      mandatoryFees: 8,
    });
    assert.equal(result.totalStatus, "confirmed");
    assert.equal(result.confirmedTotal, 120);
    assert.equal(result.fullyComparable, true);
  });

  it("unknown fees never become zero and block confirmation", () => {
    const result = calculateTrueCost({
      basePrice: 100,
      taxes: 10,
      mandatoryFees: 5,
      unknownFees: ["city tax at property"],
      totalStatus: "confirmed",
    });
    assert.equal(result.totalStatus, "partial");
    assert.equal(result.confirmedTotal, null);
    assert.deepEqual(result.unknownFees, ["city tax at property"]);
    assert.equal(result.fullyComparable, false);
  });

  it("estimated fees cannot be confirmed", () => {
    const result = calculateTrueCost({
      basePrice: 200,
      taxes: 20,
      mandatoryFees: 0,
      estimatedFees: 15,
    });
    assert.equal(result.totalStatus, "estimated");
    assert.equal(result.fullyComparable, false);
    assert.equal(result.estimatedTotal, 235);
  });

  it("preserves provider displayed total separately", () => {
    const result = calculateTrueCost({
      basePrice: 90,
      taxes: 10,
      mandatoryFees: 0,
      totalPrice: 105,
    });
    assert.equal(result.providerDisplayedTotal, 105);
    assert.equal(result.derivedConfirmedTotal, 100);
  });

  it("unavailable price stays unknown", () => {
    const result = calculateTrueCost({});
    assert.equal(result.totalStatus, "unknown");
    assert.equal(result.displayedTotal, null);
  });

  it("does not upgrade incoming estimated status", () => {
    const result = calculateTrueCost({
      basePrice: 969,
      taxes: 0,
      mandatoryFees: 0,
      totalPrice: 969,
      totalStatus: "estimated",
    });
    assert.equal(result.totalStatus, "estimated");
    assert.equal(result.fullyComparable, false);
  });
});
