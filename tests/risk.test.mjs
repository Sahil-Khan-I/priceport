import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { assessBookingRisk } from "../lib/pricing/risk.ts";

describe("assessBookingRisk", () => {
  it("flags incomplete totals and unclear eligibility", () => {
    const result = assessBookingRisk({
      propertyMatch: "exact",
      trueCost: { totalStatus: "partial", unknownFees: ["resort fee"] },
      eligibilityAssessment: { status: "eligibility_unclear" },
      cancellationStatus: "unknown",
      accessMethod: "proxy",
      sourceUrl: "https://www.booking.com/hotel/x",
    });
    assert.ok(["moderate", "high"].includes(result.level));
    assert.ok(result.warnings.some((w) => w.code === "incomplete_total"));
    assert.ok(result.warnings.some((w) => w.code === "eligibility_unverified"));
  });

  it("never claims payment was verified", () => {
    const result = assessBookingRisk({
      propertyMatch: "exact",
      trueCost: { totalStatus: "confirmed", unknownFees: [] },
      eligibilityAssessment: { status: "verified_eligible" },
      cancellationStatus: "refundable",
      accessMethod: "proxy",
      sourceUrl: "https://example.com",
    });
    assert.match(result.summary, /not guaranteed|not proven|Risk could not/i);
  });
});
