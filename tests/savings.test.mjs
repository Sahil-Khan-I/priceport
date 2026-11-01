import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  calculateSavings,
  perNight,
  stayNights,
} from "../lib/pricing/savings.ts";
import { resolveBookingLink } from "../lib/offers/booking-link.ts";

function offer(id, amount, extra = {}) {
  return {
    id,
    provider: "Booking.com",
    market: "GB",
    roomType: "Deluxe King",
    mealPlanStatus: "breakfast_included",
    cancellationStatus: "refundable",
    propertyMatch: "exact",
    comparable: true,
    trueCost: { fullyComparable: true, confirmedTotal: amount },
    conversion: { available: true, amount, currency: "INR", source: "fx-test" },
    ...extra,
  };
}

describe("stay nights and per-night", () => {
  it("computes nights from ISO dates without timezone drift", () => {
    assert.equal(stayNights("2026-11-15", "2026-11-18"), 3);
    assert.equal(stayNights("2026-11-18", "2026-11-15"), null);
    assert.equal(stayNights(null, "2026-11-18"), null);
  });

  it("returns per-night only when nights and total are known", () => {
    assert.equal(perNight(36000, 3), 12000);
    assert.equal(perNight(null, 3), null);
    assert.equal(perNight(36000, null), null);
  });
});

describe("calculateSavings", () => {
  it("uses highest minus lowest across comparable offers", () => {
    const result = calculateSavings(
      [offer("a", 39500), offer("b", 48000), offer("c", 42000)],
      { currency: "INR", checkIn: "2026-11-15", checkOut: "2026-11-18" },
    );
    assert.equal(result.headline.savings, 8500);
    assert.equal(result.headline.percent, 17.7);
    assert.equal(result.headline.lowestId, "a");
    assert.equal(result.headline.highestId, "b");
    assert.equal(result.nights, 3);
    assert.equal(result.reason, null);
  });

  it("refuses a figure with a single comparable offer", () => {
    const result = calculateSavings([offer("a", 39500)]);
    assert.equal(result.headline, null);
    assert.match(result.reason, /Not enough verified comparable offers/);
  });

  it("never compares refundable against non-refundable", () => {
    const result = calculateSavings([
      offer("a", 30000, { cancellationStatus: "non_refundable" }),
      offer("b", 48000, { cancellationStatus: "refundable" }),
    ]);
    assert.equal(result.headline, null);
  });

  it("excludes offers with unknown room or incomplete totals", () => {
    const result = calculateSavings([
      offer("a", 30000, { roomType: null }),
      offer("b", 48000),
      offer("c", 41000, { trueCost: { fullyComparable: false } }),
      offer("d", 35000, { conversion: { available: false } }),
    ]);
    assert.equal(result.headline, null);
  });

  it("reports savings separately per comparison group", () => {
    const result = calculateSavings([
      offer("a", 40000),
      offer("b", 50000),
      offer("c", 60000, { roomType: "Suite" }),
      offer("d", 61000, { roomType: "Suite" }),
    ]);
    assert.equal(result.groups.length, 2);
    assert.equal(result.headline.savings, 10000);
  });
});

describe("resolveBookingLink", () => {
  it("accepts a real property page and labels the provider", () => {
    const link = resolveBookingLink({
      provider: "Booking.com",
      sourceUrl: "https://www.booking.com/hotel/ae/atlantis-the-palm.html",
    });
    assert.equal(link.kind, "property");
    assert.equal(link.label, "View on Booking.com");
  });

  it("labels provider search pages honestly", () => {
    const link = resolveBookingLink({
      provider: "Agoda",
      sourceUrl: "https://www.agoda.com/search?checkIn=2026-11-15&city=1",
    });
    assert.equal(link.kind, "search");
    assert.match(link.label, /^Search on Agoda/);
  });

  it("does not offer a generic homepage as a booking page", () => {
    const link = resolveBookingLink({
      provider: "Expedia",
      sourceUrl: "https://www.expedia.com/",
    });
    assert.equal(link.url, null);
    assert.equal(link.kind, "unavailable");
  });

  it("rejects unsafe and invalid URLs", () => {
    for (const sourceUrl of [
      "javascript:alert(1)",
      "http://localhost:3000/x",
      "http://10.0.0.5/x",
      "not a url",
      "",
      null,
    ]) {
      const link = resolveBookingLink({ provider: "Booking.com", sourceUrl });
      assert.equal(link.url, null, String(sourceUrl));
    }
  });

  it("labels an official hotel page as the hotel website", () => {
    const link = resolveBookingLink({
      provider: "Official website",
      sourceUrl: "https://www.atlantis.com/dubai/rooms",
    });
    assert.equal(link.kind, "official");
    assert.equal(link.label, "Visit hotel website");
  });
});
