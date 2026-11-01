import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { assessEligibility } from "../lib/pricing/eligibility.ts";

describe("assessEligibility", () => {
  it("marks unavailable as restriction", () => {
    const result = assessEligibility({
      availability: "unavailable",
      propertyMatch: "exact",
      eligibility: [],
    });
    assert.equal(result.status, "restriction_detected");
    assert.equal(result.bookable, false);
  });

  it("detects residency language", () => {
    const result = assessEligibility(
      {
        availability: "available",
        propertyMatch: "exact",
        eligibility: ["Local resident rate only"],
      },
      { homeCountry: "IN" },
    );
    assert.equal(result.status, "restriction_detected");
    assert.ok(result.restrictions.includes("residency"));
  });

  it("does not invent eligibility when evidence is thin", () => {
    const result = assessEligibility({
      availability: "available",
      propertyMatch: "exact",
      eligibility: [],
    });
    assert.equal(result.status, "eligibility_unclear");
  });
});
