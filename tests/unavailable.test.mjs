import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { roomSearchInstruction } from "../lib/search/room-preferences.ts";
import {
  clearUnavailablePrices,
  explicitUnavailable,
} from "../lib/investigations/unavailable.ts";
import { planRetries } from "../lib/investigations/lifecycle.ts";
import { canReplaceJobStatus } from "../lib/investigations/deadline.ts";
import { jobProgressLabel } from "../lib/investigations/live-view.ts";

const goal = readFileSync(new URL("../lib/providers/fast-goal.ts", import.meta.url), "utf8");

describe("confirmed unavailability", () => {
  it("stops the provider goal without searching another room", () => {
    assert.match(goal, /Stop immediately/);
    assert.match(goal, /Never treat a missing price, a blocked page, a timeout/);
    assert.match(roomSearchInstruction({ category: "deluxe" }), /roomMatch to unavailable/);
    assert.match(roomSearchInstruction({ category: null }), /Do not search a higher-tier room/);
  });

  it("does not treat a timeout or missing data as unavailable", () => {
    assert.equal(explicitUnavailable(null), false);
    assert.equal(explicitUnavailable({ availability: "unknown" }), false);
    assert.equal(explicitUnavailable({ status: "timed_out" }), false);
    assert.equal(explicitUnavailable({ availability: "unavailable" }), true);
    assert.equal(explicitUnavailable({ roomMatch: "unavailable" }), true);
  });

  it("drops any price from a confirmed unavailable room", () => {
    const offer = clearUnavailablePrices({
      availability: "unavailable",
      roomMatch: "unavailable",
      roomType: "Deluxe King",
      totalPrice: 0,
      currency: "INR",
      propertyMatch: "exact",
    });
    assert.equal(offer.totalPrice, null);
    assert.equal(offer.currency, "");
    assert.equal(offer.roomType, "Deluxe King");
    assert.equal(offer.comparisonClass, "room_unavailable");
  });

  it("labels the job Unavailable and leaves the other provider running", () => {
    const jobs = [
      {
        id: "booking",
        status: "completed",
        extractionStatus: "unavailable",
        provider: "booking",
        providerName: "Booking.com",
        market: "JP",
        stage: "initial",
        url: "https://www.booking.com/hotel/x",
        goal: "find",
        offer: { availability: "unavailable", roomType: "Deluxe", totalPrice: null },
      },
      {
        id: "agoda",
        status: "extracting",
        provider: "agoda",
        providerName: "Agoda",
        market: "JP",
        stage: "initial",
        url: "https://www.agoda.com/x",
        goal: "find",
      },
      {
        id: "later",
        status: "deferred",
        provider: "booking",
        market: "GB",
        stage: "deferred",
      },
    ];
    assert.equal(jobProgressLabel(jobs[0]), "Unavailable");
    assert.equal(jobProgressLabel(jobs[1]), "Checking Agoda");
    assert.equal(jobs[2].status, "deferred");
    const retries = planRetries(jobs, null);
    assert.equal(retries.length, 0);
    assert.equal(canReplaceJobStatus("completed", "extracting"), false);
  });

  it("still retries a failed check and a timeout, not an unavailable result", () => {
    const planned = planRetries([
      {
        id: "bad",
        status: "failed",
        provider: "expedia",
        market: "JP",
        stage: "initial",
        url: "https://www.expedia.com/x",
        goal: "find",
      },
      {
        id: "slow",
        status: "timed_out",
        provider: "agoda",
        market: "US",
        stage: "initial",
        url: "https://www.agoda.com/x",
        goal: "find",
      },
      {
        id: "none",
        status: "completed",
        extractionStatus: "unavailable",
        provider: "booking",
        market: "JP",
        stage: "initial",
        url: "https://www.booking.com/hotel/x",
        goal: "find",
        offer: { availability: "unavailable" },
      },
    ], null);
    assert.deepEqual(planned.map((job) => job.replacesJobId).sort(), ["bad", "slow"]);
  });
});
