import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  accessLabel,
  dedupeEvents,
  derivePriceInsights,
  describeEvent,
  groupJobsByProvider,
  mergeJobs,
  summarizeProgress,
} from "../lib/investigations/live-view.ts";

const jobs = [
  {
    id: "a",
    provider: "booking",
    providerName: "Booking.com",
    market: "GB",
    status: "completed",
    accessMethod: "proxy",
    actualProxyCountry: "GB",
    offer: {
      totalPrice: 400,
      currency: "GBP",
      propertyMatch: "exact",
      totalStatus: "partial",
      verificationStatus: "partially_verified",
    },
  },
  {
    id: "b",
    provider: "booking",
    providerName: "Booking.com",
    market: "US",
    status: "running",
    accessMethod: "proxy",
    actualProxyCountry: "US",
    offer: null,
  },
  {
    id: "c",
    provider: "agoda",
    providerName: "Agoda",
    market: "AE",
    status: "unsupported",
    accessMethod: "unsupported",
    error: "No TinyFish proxy for AE",
    offer: null,
  },
  {
    id: "d",
    provider: "expedia",
    providerName: "Expedia",
    market: "GB",
    status: "queued",
    accessMethod: "proxy",
    offer: null,
  },
];

describe("summarizeProgress", () => {
  it("counts real job states without a fake percentage source", () => {
    const progress = summarizeProgress(jobs);
    assert.equal(progress.total, 4);
    assert.equal(progress.completed, 1);
    assert.equal(progress.researching, 1);
    assert.equal(progress.waiting, 1);
    assert.equal(progress.attention, 1);
    assert.equal(progress.terminal, 2);
    assert.equal(progress.offers, 1);
    assert.equal(progress.fraction, 0.5);
  });

  it("handles an empty investigation", () => {
    const progress = summarizeProgress([]);
    assert.equal(progress.total, 0);
    assert.equal(progress.fraction, 0);
    assert.equal(progress.offers, 0);
  });
});

describe("groupJobsByProvider", () => {
  it("groups markets under a provider", () => {
    const groups = groupJobsByProvider(jobs);
    const booking = groups.find((g) => g.provider === "Booking.com");
    assert.equal(booking.markets, 2);
    assert.equal(booking.completed, 1);
    assert.equal(booking.offers, 1);
  });
});

describe("events", () => {
  it("dedupes by id", () => {
    const merged = dedupeEvents([
      { id: "1", type: "STARTED", message: "a" },
      { id: "1", type: "STARTED", message: "a" },
      { id: "2", type: "COMPLETE", message: "b" },
    ]);
    assert.equal(merged.length, 2);
  });

  it("translates events without inventing heartbeats", () => {
    assert.equal(
      describeEvent({ id: "h", type: "HEARTBEAT", message: "Heartbeat" }, jobs),
      null,
    );
    assert.match(
      describeEvent({ id: "s", type: "STARTED", jobId: "a" }, jobs) || "",
      /Booking.com/,
    );
  });
});

describe("mergeJobs", () => {
  it("does not let a stale queued snapshot erase a completed offer", () => {
    const merged = mergeJobs(
      [
        {
          id: "a",
          status: "completed",
          offer: { totalPrice: 10, currency: "USD" },
        },
      ],
      [{ id: "a", status: "queued", offer: null }],
    );
    assert.equal(merged[0].status, "completed");
    assert.equal(merged[0].offer.totalPrice, 10);
  });
});

describe("derivePriceInsights", () => {
  it("only states a market difference when both prices exist", () => {
    const insights = derivePriceInsights([
      {
        id: "1",
        providerName: "Booking.com",
        market: "GB",
        offer: { totalPrice: 200, currency: "GBP", totalStatus: "partial" },
      },
      {
        id: "2",
        providerName: "Booking.com",
        market: "US",
        offer: { totalPrice: 260, currency: "GBP", totalStatus: "partial" },
      },
    ]);
    assert.ok(insights.some((line) => /GB/.test(line) && /US/.test(line)));
    assert.ok(insights.some((line) => /fee breakdown/i.test(line)));
  });

  it("stays empty when there are no offers", () => {
    assert.deepEqual(derivePriceInsights([]), []);
  });
});

describe("accessLabel", () => {
  it("labels proxy and unsupported honestly", () => {
    assert.equal(accessLabel(jobs[0]), "Proxy · GB");
    assert.equal(accessLabel(jobs[2]), "Unsupported");
  });
});
