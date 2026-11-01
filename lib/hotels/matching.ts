/**
 * Hotel / room matching — never treat similar names as equivalent automatically.
 * Exact match requires adequate identity evidence beyond the name alone.
 */

export function matchProperty(requested, extracted) {
  if (!requested || !extracted) {
    return { status: "unknown", reasons: ["Insufficient identity data"] };
  }

  const reqName = normalizeName(requested.name || requested.hotelName);
  const extName = normalizeName(
    extracted.hotelName || extracted.property_or_product || extracted.name,
  );

  if (!reqName || !extName) {
    return { status: "unknown", reasons: ["Missing property name"] };
  }

  const reasons: string[] = [];
  const cityOk = citiesCompatible(requested, extracted);
  const nameExact = reqName === extName;
  const nameContained =
    !nameExact && (extName.includes(reqName) || reqName.includes(extName));

  const tokensA = new Set(reqName.split(" ").filter((t) => t.length > 2));
  const tokensB = new Set(extName.split(" ").filter((t) => t.length > 2));
  const overlap = [...tokensA].filter((t) => tokensB.has(t)).length;
  const ratio = overlap / Math.max(tokensA.size, 1);

  if (cityOk === false) {
    reasons.push(
      nameExact
        ? "Exact normalized name match"
        : nameContained
          ? "Partial name containment"
          : `Token overlap ${overlap}/${tokensA.size}`,
    );
    reasons.push("Location conflict");
    return { status: "unmatched", reasons };
  }

  // Exact requires name equality AND compatible location evidence.
  if (nameExact) {
    reasons.push("Exact normalized name match");
    if (cityOk === true) {
      reasons.push("Location compatible");
      return { status: "exact", reasons };
    }
    reasons.push("Location not established — cannot assign exact match");
    return { status: "probable", reasons };
  }

  if (nameContained) {
    reasons.push("Partial name containment");
    if (cityOk === true) {
      reasons.push("Location compatible");
      return { status: "probable", reasons };
    }
    reasons.push("Location not established");
    return { status: "partial", reasons };
  }

  if (ratio >= 0.7) {
    reasons.push(`Token overlap ${overlap}/${tokensA.size}`);
    if (cityOk === true) {
      reasons.push("Location compatible");
      return { status: "probable", reasons };
    }
    return { status: "partial", reasons: [...reasons, "Location not established"] };
  }

  if (ratio >= 0.4) {
    reasons.push(`Weak token overlap ${overlap}/${tokensA.size}`);
    return { status: "partial", reasons };
  }

  return {
    status: "unmatched",
    reasons: ["Names do not sufficiently match"],
  };
}

export function compareBookingDetails(
  requested: Record<string, unknown> = {},
  extracted: Record<string, unknown> = {},
) {
  const differences: string[] = [];
  const unknowns: string[] = [];

  for (const field of ["checkIn", "checkOut"]) {
    const left = normalizeLoose(requested[field]);
    const right = normalizeLoose(extracted[field]);
    if (!right) unknowns.push(`${field} not reported by extraction`);
    else if (left && right && left !== right) {
      differences.push(`${field} differs (${requested[field]} vs ${extracted[field]})`);
    }
  }

  for (const field of ["adults", "children", "rooms"]) {
    const left = requested[field];
    const right = extracted[field];
    if (right == null) unknowns.push(`${field} not reported by extraction`);
    else if (left != null && Number(left) !== Number(right)) {
      differences.push(`${field} differs (${left} vs ${right})`);
    }
  }

  return {
    equivalent: differences.length === 0,
    differences,
    unknowns,
  };
}

export function compareRoomConditions(
  a: Record<string, unknown> = {},
  b: Record<string, unknown> = {},
) {
  const differences: string[] = [];
  const unknowns: string[] = [];
  const fields: Array<[string, string]> = [
    ["roomType", "Room category"],
    ["mealPlan", "Meal plan"],
    ["cancellationPolicy", "Cancellation"],
    ["bedConfiguration", "Bed configuration"],
    ["refundable", "Refundability"],
  ];

  for (const [key, label] of fields) {
    const left = normalizeLoose(a[key]);
    const right = normalizeLoose(b[key]);
    if (!left || !right) {
      if (!left && !right) unknowns.push(`${label} unknown on both offers`);
      else unknowns.push(`${label} unknown on one offer`);
      continue;
    }
    if (left !== right) {
      differences.push(`${label} differs (${a[key]} vs ${b[key]})`);
    }
  }

  return {
    equivalent: differences.length === 0 && unknowns.length === 0,
    comparable: differences.length === 0,
    differences,
    unknowns,
  };
}

/**
 * Classify room similarity against a reference room string (requested or baseline).
 * Never invent a match when either side is missing.
 */
export function classifyRoomMatch(requestedRoom, extractedRoom) {
  const a = normalizeLoose(requestedRoom);
  const b = normalizeLoose(extractedRoom);
  if (!a && !b) return { status: "unknown", reasons: ["Room type not established"] };
  if (!a || !b) {
    return {
      status: "unknown",
      reasons: ["Room type missing on one side — cannot claim a match"],
    };
  }
  if (a === b) return { status: "exact", reasons: ["Exact room label match"] };
  if (a.includes(b) || b.includes(a)) {
    return { status: "similar", reasons: ["Partial room label containment"] };
  }
  const tokensA = new Set(a.split(" ").filter((t) => t.length > 2));
  const tokensB = new Set(b.split(" ").filter((t) => t.length > 2));
  const overlap = [...tokensA].filter((t) => tokensB.has(t)).length;
  if (overlap >= 2) {
    return { status: "similar", reasons: [`Shared room tokens: ${overlap}`] };
  }
  return { status: "different", reasons: ["Room labels do not match"] };
}

export function classifyMealPlan(mealPlan) {
  const value = normalizeLoose(mealPlan);
  if (!value) return "unknown";
  if (/breakfast|bb|bed and breakfast|includes breakfast/i.test(value)) {
    return "breakfast_included";
  }
  if (/room only|no meals|self catering|accommodation only/i.test(value)) {
    return "breakfast_not_included";
  }
  if (/half board|full board|all inclusive|dinner|lunch/i.test(value)) {
    return "other_meal_plan";
  }
  return "unknown";
}

export function classifyCancellation(policy, refundable = null) {
  if (typeof refundable === "boolean") {
    return refundable ? "refundable" : "non_refundable";
  }
  const value = normalizeLoose(policy);
  if (!value) return "unknown";
  if (/non[-\s]?refundable|no refund|non refundable/i.test(value)) {
    return "non_refundable";
  }
  if (/partial(ly)? refund|partial cancellation/i.test(value)) {
    return "partially_refundable";
  }
  if (/free cancellation|fully refundable|refundable|cancel free/i.test(value)) {
    return "refundable";
  }
  return "unknown";
}

function normalizeName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(hotel|resort|the|and|&)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeLoose(value) {
  if (value == null) return "";
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value).toLowerCase().replace(/\s+/g, " ").trim();
}

function citiesCompatible(requested, extracted) {
  const a = normalizeName(
    requested.location || requested.city || requested.propertyAddress || "",
  );
  const b = normalizeName(
    extracted.location ||
      extracted.city ||
      extracted.propertyAddress ||
      extracted.address ||
      "",
  );
  if (!a || !b) return null;
  if (a === b || a.includes(b) || b.includes(a)) return true;
  return false;
}
