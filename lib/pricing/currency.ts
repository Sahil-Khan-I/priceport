/**
 * Currency helpers — never invent FX rates.
 * Uses Frankfurter (ECB) when available; otherwise marks conversion unavailable.
 * INR/AED are often unsupported by ECB — that is reported honestly.
 * https://www.frankfurter.app/docs/
 */

const CACHE = new Map();
const CACHE_TTL_MS = 60 * 60 * 1000;

/** Injectable for deterministic unit tests. */
let fetchImpl = globalThis.fetch.bind(globalThis);

export function setCurrencyFetch(fn) {
  fetchImpl = fn;
}

export function resetCurrencyFetch() {
  fetchImpl = globalThis.fetch.bind(globalThis);
  CACHE.clear();
}

export function clearCurrencyCache() {
  CACHE.clear();
}

export function formatMoney(amount, currency = "USD") {
  if (amount == null || Number.isNaN(Number(amount))) return "—";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(Number(amount));
  } catch {
    return `${currency} ${amount}`;
  }
}

export async function convertAmount(amount, fromCurrency, toCurrency) {
  if (amount == null || !fromCurrency || !toCurrency) {
    return unavailable("Missing amount or currency");
  }

  const from = String(fromCurrency).toUpperCase();
  const to = String(toCurrency).toUpperCase();

  if (!/^[A-Z]{3}$/.test(from) || !/^[A-Z]{3}$/.test(to)) {
    return unavailable(`Invalid currency code (${fromCurrency} → ${toCurrency})`);
  }

  if (from === to) {
    return {
      available: true,
      originalAmount: roundMoney(amount),
      originalCurrency: from,
      amount: roundMoney(amount),
      rate: 1,
      from,
      to,
      source: "identity",
      fetchedAt: new Date().toISOString(),
    };
  }

  try {
    const rateInfo = await fetchRate(from, to);
    if (!rateInfo.available) {
      return {
        ...rateInfo,
        originalAmount: roundMoney(amount),
        originalCurrency: from,
      };
    }

    return {
      available: true,
      originalAmount: roundMoney(amount),
      originalCurrency: from,
      amount: roundMoney(Number(amount) * rateInfo.rate),
      rate: rateInfo.rate,
      from,
      to,
      source: rateInfo.source,
      fetchedAt: rateInfo.fetchedAt,
    };
  } catch (error) {
    return {
      ...unavailable(error instanceof Error ? error.message : "FX lookup failed"),
      originalAmount: roundMoney(amount),
      originalCurrency: from,
    };
  }
}

async function fetchRate(from, to) {
  const key = `${from}:${to}`;
  const cached = CACHE.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.value;
  }

  const url = `https://api.frankfurter.app/latest?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
  const response = await fetchImpl(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!response.ok) {
    const value = unavailable(
      `FX provider returned ${response.status}. Conversion unavailable for ${from}→${to}.`,
    );
    CACHE.set(key, { at: Date.now(), value });
    return value;
  }

  const data = await response.json();
  const rate = data?.rates?.[to];
  if (typeof rate !== "number") {
    const value = unavailable(
      `No published rate for ${from}→${to}. Original currency preserved.`,
    );
    CACHE.set(key, { at: Date.now(), value });
    return value;
  }

  const value = {
    available: true,
    rate,
    from,
    to,
    source: "frankfurter.app (ECB)",
    fetchedAt: data.date
      ? `${data.date}T00:00:00.000Z`
      : new Date().toISOString(),
  };
  CACHE.set(key, { at: Date.now(), value });
  return value;
}

function unavailable(reason) {
  return {
    available: false,
    amount: null,
    rate: null,
    from: null,
    to: null,
    source: null,
    fetchedAt: null,
    reason,
  };
}

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}
