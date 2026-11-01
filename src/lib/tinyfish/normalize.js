/**
 * Normalize TinyFish agent / fetch outputs into Priceport's investigation result shape.
 * Never invent prices — only map what was returned.
 */

export function createEmptyInvestigationResult(partial = {}) {
  return {
    provider: "",
    market_view: "",
    actual_proxy_country: null,
    property_or_product: "",
    match_status: "unknown",
    price: null,
    currency: "",
    base_price: null,
    mandatory_fees: [],
    estimated_fees: [],
    unknown_fees: [],
    total_price: null,
    availability: "unknown",
    eligibility: [],
    offer_type: "",
    cancellation_terms: null,
    source_url: "",
    checked_at: "",
    evidence: [],
    tinyfish_run_id: null,
    investigation_status: "",
    raw: null,
    ...partial,
  };
}

export function normalizeAgentRun(run, context = {}) {
  const result = createEmptyInvestigationResult({
    provider: context.provider || "",
    market_view: context.marketView || "",
    actual_proxy_country: context.actualProxyCountry ?? null,
    source_url: context.sourceUrl || context.url || "",
    tinyfish_run_id: run?.run_id || null,
    investigation_status: mapRunStatus(run?.status),
    checked_at: run?.finished_at || new Date().toISOString(),
    raw: run?.result ?? null,
  });

  const payload = unwrapResult(run?.result);
  if (!payload || typeof payload !== "object") {
    return result;
  }

  return {
    ...result,
    property_or_product:
      payload.property_or_product ||
      payload.property ||
      payload.hotel ||
      payload.name ||
      result.property_or_product,
    price: pickNumber(payload.price ?? payload.total_price ?? payload.amount),
    currency: payload.currency || result.currency,
    base_price: pickNumber(payload.base_price ?? payload.basePrice),
    total_price: pickNumber(
      payload.total_price ?? payload.totalPrice ?? payload.price,
    ),
    availability: payload.availability || result.availability,
    eligibility: Array.isArray(payload.eligibility)
      ? payload.eligibility
      : result.eligibility,
    offer_type: payload.offer_type || payload.offerType || "",
    cancellation_terms:
      payload.cancellation_terms ?? payload.cancellationTerms ?? null,
    mandatory_fees: Array.isArray(payload.mandatory_fees)
      ? payload.mandatory_fees
      : [],
    estimated_fees: Array.isArray(payload.estimated_fees)
      ? payload.estimated_fees
      : [],
    unknown_fees: Array.isArray(payload.unknown_fees)
      ? payload.unknown_fees
      : [],
    evidence: Array.isArray(payload.evidence) ? payload.evidence : [],
    source_url: payload.source_url || payload.sourceUrl || result.source_url,
  };
}

function unwrapResult(result) {
  if (!result) return null;
  if (typeof result === "object" && result.result !== undefined) {
    return result.result;
  }
  return result;
}

function mapRunStatus(status) {
  if (!status) return "unknown";
  const value = String(status).toUpperCase();
  if (value === "COMPLETED") return "completed";
  if (value === "FAILED") return "failed";
  if (value === "CANCELLED" || value === "CANCELED") return "failed";
  if (value === "RUNNING" || value === "PENDING") return "starting";
  return String(status).toLowerCase();
}

function pickNumber(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/[^0-9.-]/g, "");
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}
