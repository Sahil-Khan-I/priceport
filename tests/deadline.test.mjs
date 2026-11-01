import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { INVESTIGATION_DEADLINE_MS, JOB_TIMEOUT_MS } from "../lib/investigations/status.ts";
import {
  applyDeadline,
  canReplaceJobStatus,
  planSearchPairs,
  shouldFinalize,
} from "../lib/investigations/deadline.ts";

describe("initial search plan", () => {
  it("starts two providers on the primary market and keeps the other markets", () => {
    const plan = planSearchPairs(["booking", "agoda"], ["JP", "GB"]);
    assert.equal(plan.initial.length, 2);
    assert.equal(plan.primaryMarket, "JP");
    assert.deepEqual(
      plan.deferred.map((pair) => pair.market),
      ["GB", "GB"],
    );
    assert.equal(plan.initial.length + plan.deferred.length, 4);
  });
});

describe("two-minute deadline", () => {
  it("defaults to 120 seconds and does not leave an 8-minute job timeout", () => {
    assert.equal(INVESTIGATION_DEADLINE_MS, 120_000);
    assert.ok(JOB_TIMEOUT_MS <= INVESTIGATION_DEADLINE_MS);
  });

  it("times out active jobs and queued jobs that have not started", () => {
    const { jobs } = applyDeadline([
      { id: "run", stage: "initial", status: "extracting", offer: { totalPrice: 100 } },
      { id: "wait", stage: "initial", status: "queued" },
      { id: "later", stage: "deferred", status: "deferred" },
    ]);
    assert.equal(jobs[0].status, "timed_out");
    assert.equal(jobs[0].offer.totalPrice, 100);
    assert.equal(jobs[1].status, "timed_out");
    assert.match(jobs[1].error, /Not started/);
    assert.equal(jobs[2].status, "deferred");
  });

  it("does not let a late completion replace a timeout", () => {
    assert.equal(canReplaceJobStatus("timed_out", "completed"), false);
    assert.equal(canReplaceJobStatus("extracting", "completed"), true);
  });

  it("finalizes once, even when one provider failed and another has an offer", () => {
    const jobs = [
      { status: "completed", offer: { totalPrice: 80 } },
      { status: "failed" },
      { status: "deferred" },
    ];
    assert.equal(shouldFinalize(jobs, null), true);
    assert.equal(shouldFinalize(jobs, "2026-11-01T00:00:00.000Z"), false);
    assert.equal(shouldFinalize([{ status: "queued" }], null), false);
  });
});
