/**
 * True-cost engine.
 * Unknown fees never become zero. Estimated never becomes confirmed.
 * Provider displayed totals are preserved separately from derived sums.
 */

export function calculateTrueCost({
  basePrice = null,
  taxes = null,
  mandatoryFees = null,
  estimatedFees = null,
  unknownFees = [],
  totalPrice = null,
  totalStatus = null,
}: {
  basePrice?: number | null;
  taxes?: number | null;
  mandatoryFees?: number | null;
  estimatedFees?: number | null;
  unknownFees?: unknown[];
  totalPrice?: number | null;
  totalStatus?: string | null;
} = {}) {
  const unknowns = Array.isArray(unknownFees) ? unknownFees.filter(Boolean) : [];
  const hasUnknown = unknowns.length > 0;

  const base = asNumber(basePrice);
  const tax = asNumber(taxes);
  const mandatory = asNumber(mandatoryFees);
  const estimated = asNumber(estimatedFees);
  const providerDisplayedTotal = asNumber(totalPrice);

  const feeComponentsKnown = tax !== null && mandatory !== null;
  const feeComponentsMissing = tax === null || mandatory === null;

  let derivedConfirmed: number | null = null;
  if (base !== null && feeComponentsKnown) {
    derivedConfirmed = roundMoney(base + tax + mandatory);
  } else if (base !== null && tax === null && mandatory === null && !hasUnknown) {
    // Base alone is not a confirmed all-in total.
    derivedConfirmed = null;
  }

  const estimatedTotal =
    derivedConfirmed != null && estimated !== null
      ? roundMoney(derivedConfirmed + estimated)
      : providerDisplayedTotal != null && estimated !== null
        ? roundMoney(providerDisplayedTotal + estimated)
        : null;

  const incoming = normalizeStatus(totalStatus);
  let status = incoming || "incomplete";

  if (!incoming || incoming === "incomplete") {
    if (base === null && providerDisplayedTotal === null) {
      status = "unknown";
    } else if (hasUnknown || feeComponentsMissing) {
      status = "partial";
    } else if (estimated !== null) {
      status = "estimated";
    } else if (derivedConfirmed != null || providerDisplayedTotal != null) {
      status = "confirmed";
    } else {
      status = "unknown";
    }
  }

  // Never upgrade weaker evidence.
  if (hasUnknown && status === "confirmed") status = "partial";
  if (estimated !== null && status === "confirmed") status = "estimated";
  if (feeComponentsMissing && status === "confirmed") status = "partial";
  if (incoming === "estimated" && status === "confirmed") status = "estimated";
  if (incoming === "partial" && status === "confirmed") status = "partial";

  const displayedTotal =
    providerDisplayedTotal != null
      ? providerDisplayedTotal
      : derivedConfirmed != null
        ? derivedConfirmed
        : base;

  const confirmedTotal =
    status === "confirmed" && !hasUnknown
      ? derivedConfirmed != null
        ? derivedConfirmed
        : providerDisplayedTotal
      : null;

  return {
    basePrice: base,
    taxes: tax,
    mandatoryFees: mandatory,
    estimatedFees: estimated,
    unknownFees: unknowns,
    providerDisplayedTotal,
    derivedConfirmedTotal: derivedConfirmed,
    confirmedTotal,
    displayedTotal,
    estimatedTotal,
    totalStatus: status,
    fullyComparable:
      status === "confirmed" &&
      !hasUnknown &&
      confirmedTotal != null &&
      feeComponentsKnown,
  };
}

function asNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/[^0-9.-]/g, "");
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeStatus(status: unknown): string | null {
  if (!status) return null;
  const value = String(status).toLowerCase();
  if (
    ["confirmed", "partial", "estimated", "incomplete", "unknown"].includes(value)
  ) {
    return value;
  }
  return null;
}

function roundMoney(value: number) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}
