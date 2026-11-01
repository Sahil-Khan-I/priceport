import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  convertAmount,
  setCurrencyFetch,
  resetCurrencyFetch,
} from "../lib/pricing/currency.ts";

describe("convertAmount", () => {
  beforeEach(() => {
    resetCurrencyFetch();
  });

  afterEach(() => {
    resetCurrencyFetch();
  });

  it("identity conversion", async () => {
    const result = await convertAmount(100, "USD", "USD");
    assert.equal(result.available, true);
    assert.equal(result.amount, 100);
    assert.equal(result.rate, 1);
    assert.equal(result.source, "identity");
    assert.equal(result.originalCurrency, "USD");
  });

  it("uses fixture FX rate for GBP → USD", async () => {
    setCurrencyFetch(async () => ({
      ok: true,
      json: async () => ({ date: "2026-11-01", rates: { USD: 1.25 } }),
    }));
    const result = await convertAmount(100, "GBP", "USD");
    assert.equal(result.available, true);
    assert.equal(result.amount, 125);
    assert.equal(result.rate, 1.25);
    assert.equal(result.from, "GBP");
    assert.equal(result.to, "USD");
    assert.equal(result.source, "frankfurter.app (ECB)");
    assert.equal(result.fetchedAt, "2026-11-01T00:00:00.000Z");
    assert.equal(result.originalAmount, 100);
  });

  it("marks missing FX rate unavailable (e.g. AED → INR)", async () => {
    setCurrencyFetch(async () => ({
      ok: true,
      json: async () => ({ date: "2026-11-01", rates: {} }),
    }));
    const result = await convertAmount(100, "AED", "INR");
    assert.equal(result.available, false);
    assert.equal(result.amount, null);
    assert.match(result.reason, /No published rate/);
    assert.equal(result.originalAmount, 100);
    assert.equal(result.originalCurrency, "AED");
  });

  it("handles FX endpoint failure", async () => {
    setCurrencyFetch(async () => ({ ok: false, status: 503 }));
    const result = await convertAmount(50, "EUR", "USD");
    assert.equal(result.available, false);
    assert.match(result.reason, /503/);
  });

  it("rejects invalid currency", async () => {
    const result = await convertAmount(10, "XX", "USD");
    assert.equal(result.available, false);
    assert.match(result.reason, /Invalid currency/);
  });

  it("handles missing inputs", async () => {
    const result = await convertAmount(null, "USD", "EUR");
    assert.equal(result.available, false);
  });
});
