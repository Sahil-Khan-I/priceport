import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  detectPriceMovement,
  observationKey,
} from "../lib/pricing/observations.ts";

const base = {
  hotelName: "Atlantis The Palm",
  provider: "Booking.com",
  market: "GB",
  checkIn: "2026-12-10",
  checkOut: "2026-12-13",
  adults: 2,
  children: 0,
  rooms: 1,
  roomType: "King",
  currency: "GBP",
  totalStatus: "partial",
};

describe("observationKey", () => {
  it("groups same stay identity", () => {
    assert.equal(
      observationKey({ ...base, displayedTotal: 100 }),
      observationKey({ ...base, displayedTotal: 200 }),
    );
  });

  it("separates different markets", () => {
    assert.notEqual(
      observationKey({ ...base, market: "GB" }),
      observationKey({ ...base, market: "US" }),
    );
  });
});

describe("detectPriceMovement", () => {
  it("requires two observations", () => {
    const result = detectPriceMovement(null, {
      ...base,
      displayedTotal: 100,
      checkedAt: "2026-01-02T00:00:00.000Z",
    });
    assert.equal(result.available, false);
  });

  it("detects meaningful drop", () => {
    const previous = {
      ...base,
      displayedTotal: 1000,
      checkedAt: "2026-01-01T00:00:00.000Z",
    };
    const current = {
      ...base,
      displayedTotal: 900,
      checkedAt: "2026-01-02T00:00:00.000Z",
    };
    const result = detectPriceMovement(previous, current);
    assert.equal(result.available, true);
    assert.equal(result.direction, "drop");
    assert.equal(result.meaningful, true);
  });

  it("refuses currency mismatch", () => {
    const result = detectPriceMovement(
      {
        ...base,
        displayedTotal: 100,
        currency: "GBP",
        checkedAt: "2026-01-01T00:00:00.000Z",
      },
      {
        ...base,
        displayedTotal: 120,
        currency: "USD",
        checkedAt: "2026-01-02T00:00:00.000Z",
      },
    );
    assert.equal(result.available, false);
  });
});
