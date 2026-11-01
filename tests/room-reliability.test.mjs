import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { roomSearchInstruction } from "../lib/search/room-preferences.ts";
import {
  classifyExecutionFailure,
  deriveInvestigationStatus,
  planSearchPairs,
} from "../lib/investigations/deadline.ts";
import { canReplaceJobStatus } from "../lib/investigations/deadline.ts";
import { formatElapsed } from "../lib/investigations/live-view.ts";

describe("room selection instructions", () => {
  it("searches only Standard when that category is selected", () => {
    const text = roomSearchInstruction({ category: "standard", bedType: "queen" });
    assert.match(text, /Search only the Standard room category/);
    assert.match(text, /Queen bed/);
    assert.match(text, /Do not search any other room category/);
  });

  it("searches only Deluxe when that category is selected", () => {
    const text = roomSearchInstruction({ category: "deluxe", bedType: null });
    assert.match(text, /Search only the Deluxe room category/);
    assert.match(text, /Do not substitute a cheaper room/);
  });

  it("uses only the base room when no category is selected", () => {
    const text = roomSearchInstruction({ category: null, bedType: "king" });
    assert.match(text, /base room/);
    assert.match(text, /Standard, Classic/);
    assert.match(text, /Do not inspect or compare other room categories/);
    assert.match(text, /Do not choose a room because it is the cheapest/);
    assert.match(text, /Do not search a higher-tier room/);
    assert.match(text, /King bed/);
    assert.doesNotMatch(text, /Deluxe/);
  });

  it("treats any the same as no category", () => {
    const text = roomSearchInstruction({ category: "any" });
    assert.match(text, /base room/);
    assert.doesNotMatch(text, /Search only the Standard room/);
  });
});

describe("provider failures", () => {
  it("keeps an unexpected abort as a failure, not a deadline timeout", () => {
    const abort = Object.assign(new Error("This operation was aborted"), { name: "AbortError" });
    const outcome = classifyExecutionFailure(abort);
    assert.equal(outcome.status, "failed");
    assert.doesNotMatch(outcome.message, /operation was aborted/i);
  });

  it("keeps a real provider error as failed", () => {
    const outcome = classifyExecutionFailure(new Error("Booking page blocked"));
    assert.equal(outcome.status, "failed");
    assert.match(outcome.message, /blocked/);
  });

  it("keeps one success and one timeout as a partial investigation", () => {
    const status = deriveInvestigationStatus([
      { status: "completed", stage: "initial", offer: { totalPrice: 120 } },
      { status: "timed_out", stage: "initial" },
      { status: "deferred", stage: "deferred" },
    ]);
    assert.equal(status, "partial");
  });

  it("treats a confirmed unavailable room as a completed outcome", () => {
    const status = deriveInvestigationStatus([
      { status: "completed", stage: "initial", extractionStatus: "unavailable" },
      { status: "completed", stage: "initial", offer: { totalPrice: 80 } },
    ]);
    assert.equal(status, "completed");
  });

  it("does not let a late callback replace a completed job", () => {
    assert.equal(canReplaceJobStatus("completed", "failed"), false);
    assert.equal(canReplaceJobStatus("timed_out", "failed"), false);
  });

  it("leaves extra markets deferred", () => {
    const plan = planSearchPairs(["booking", "agoda"], ["JP", "GB", "US"]);
    assert.equal(plan.initial.length, 2);
    assert.equal(plan.deferred.length, 4);
    assert.ok(plan.deferred.every((pair) => pair.stage === "deferred"));
  });

  it("shows elapsed time past two minutes without capping it", () => {
    const started = "2026-11-01T00:00:00.000Z";
    const startMs = Date.parse(started);
    assert.equal(formatElapsed(started, startMs + 131_000), "2m 11s");
    assert.equal(formatElapsed(started, startMs + 45_000), "0m 45s");
  });
});
