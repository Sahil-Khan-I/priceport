import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  canReplaceJobStatus,
  classifyExecutionFailure,
  deriveInvestigationStatus,
  planSearchPairs,
  shouldFinalize,
} from "../lib/investigations/deadline.ts";
import { resolveStreamOutcome, planRetries } from "../lib/investigations/lifecycle.ts";
import { formatElapsed } from "../lib/investigations/live-view.ts";

describe("initial search plan", () => {
  it("starts two providers on the primary market and keeps the other markets", () => {
    const plan = planSearchPairs(["booking", "agoda"], ["JP", "GB"]);
    assert.equal(plan.initial.length, 2);
    assert.equal(plan.primaryMarket, "JP");
    assert.deepEqual(plan.deferred.map((pair) => pair.market), ["GB", "GB"]);
  });

  it("does not let deferred markets block the first comparison", () => {
    assert.equal(
      shouldFinalize(
        [
          { status: "completed", stage: "initial" },
          { status: "deferred", stage: "deferred" },
        ],
        null,
      ),
      true,
    );
    assert.equal(shouldFinalize([{ status: "extracting", stage: "initial" }], null), false);
  });
});

describe("open-ended provider checks", () => {
  it("does not treat an abort as an automatic timeout", () => {
    const abort = Object.assign(new Error("This operation was aborted"), { name: "AbortError" });
    const outcome = classifyExecutionFailure(abort);
    assert.equal(outcome.status, "failed");
    assert.doesNotMatch(outcome.message, /operation was aborted/i);
    assert.equal(classifyExecutionFailure(abort, { cancelled: true }).status, "cancelled");
  });

  it("stores a completion after a long run as completed", () => {
    const started = Date.parse("2026-11-01T00:00:00.000Z");
    const elapsed = formatElapsed("2026-11-01T00:00:00.000Z", started + 131_000);
    assert.equal(elapsed, "2m 11s");
    assert.equal(
      deriveInvestigationStatus([
        { status: "completed", stage: "initial", offer: { totalPrice: 90 } },
        { status: "extracting", stage: "initial" },
      ]),
      "running",
    );
  });

  it("fails a stream that ends without a result", () => {
    const outcome = resolveStreamOutcome(null);
    assert.equal(outcome.status, "failed");
    assert.match(outcome.error, /ended before TinyFish returned/);
  });

  it("keeps one offer when another provider fails", () => {
    const status = deriveInvestigationStatus([
      { status: "completed", stage: "initial", offer: { totalPrice: 80 } },
      { status: "failed", stage: "initial" },
      { status: "deferred", stage: "deferred" },
    ]);
    assert.equal(status, "partial");
    assert.equal(shouldFinalize([{ status: "completed" }, { status: "failed" }], "done"), false);
  });

  it("does not overwrite a cancelled job and retries an interrupted one manually", () => {
    assert.equal(canReplaceJobStatus("cancelled", "completed"), false);
    assert.equal(canReplaceJobStatus("completed", "failed"), false);
    const planned = planRetries(
      [
        {
          id: "old",
          status: "interrupted",
          provider: "booking",
          market: "US",
          stage: "initial",
          url: "https://www.booking.com/hotel/ae/x.html",
          goal: "price",
        },
      ],
      null,
    );
    assert.equal(planned.length, 1);
    assert.equal(planned[0].replacesJobId, "old");
  });
});
