/**
 * True-cost engine.
 * Unknown mandatory charges are never treated as zero.
 */

export function calculateTrueCost({
  basePrice = null,
  taxes = null,
  mandatoryFees = null,
  estimatedFees = null,
  unknownFees = [],
  totalPrice = null,
  totalStatus = null,
}) {
  const unknowns = Array.isArray(unknownFees) ? unknownFees.filter(Boolean) : [];
  const hasUnknown = unknowns.length > 0;

  const parts = [basePrice, taxes, mandatoryFees].filter((v) => typeof v === "number");
  const confirmedSum =
    parts.length > 0
      ? roundMoney(parts.reduce((sum, n) => sum + n, 0))
      : typeof totalPrice === "number"
        ? roundMoney(totalPrice)
        : null;

  const estimated =
    typeof estimatedFees === "number" && confirmedSum != null
      ? roundMoney(confirmedSum + estimatedFees)
      : null;

  let status = totalStatus || "incomplete";
  if (!status || status === "incomplete") {
    if (hasUnknown) status = "partial";
    else if (typeof estimatedFees === "number") status = "estimated";
    else if (confirmedSum != null) status = "confirmed";
    else status = "unknown";
  }

  if (hasUnknown && status === "confirmed") {
    status = "partial";
  }

  return {
    basePrice: typeof basePrice === "number" ? basePrice : null,
    taxes: typeof taxes === "number" ? taxes : null,
    mandatoryFees: typeof mandatoryFees === "number" ? mandatoryFees : null,
    estimatedFees: typeof estimatedFees === "number" ? estimatedFees : null,
    unknownFees: unknowns,
    confirmedTotal: hasUnknown ? null : confirmedSum,
    displayedTotal: confirmedSum,
    estimatedTotal: estimated,
    totalStatus: status,
    fullyComparable: status === "confirmed" && !hasUnknown && confirmedSum != null,
  };
}

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}
