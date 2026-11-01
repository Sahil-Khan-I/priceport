/**
 * Hotel / room matching — never treat similar names as equivalent automatically.
 */

export function matchProperty(requested, extracted) {
  if (!requested || !extracted) {
    return { status: "unknown", reasons: ["Insufficient identity data"] };
  }

  const reqName = normalizeName(requested.name || requested.hotelName);
  const extName = normalizeName(
    extracted.hotelName || extracted.property_or_product || extracted.name,
  );

  const reasons = [];
  if (!reqName || !extName) {
    return { status: "unknown", reasons: ["Missing property name"] };
  }

  if (reqName === extName) {
    reasons.push("Exact normalized name match");
    return { status: "exact", reasons };
  }

  if (extName.includes(reqName) || reqName.includes(extName)) {
    reasons.push("Partial name containment");
    const cityOk = citiesCompatible(requested, extracted);
    if (cityOk === false) {
      return {
        status: "unmatched",
        reasons: [...reasons, "Location conflict"],
      };
    }
    return {
      status: cityOk ? "probable" : "partial",
      reasons,
    };
  }

  const tokensA = new Set(reqName.split(" ").filter((t) => t.length > 2));
  const tokensB = new Set(extName.split(" ").filter((t) => t.length > 2));
  const overlap = [...tokensA].filter((t) => tokensB.has(t)).length;
  const ratio = overlap / Math.max(tokensA.size, 1);

  if (ratio >= 0.7) {
    reasons.push(`Token overlap ${overlap}/${tokensA.size}`);
    return { status: "probable", reasons };
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

export function compareRoomConditions(a = {}, b = {}) {
  const differences = [];
  const fields = [
    ["roomType", "Room category"],
    ["mealPlan", "Meal plan"],
    ["cancellationPolicy", "Cancellation"],
  ];

  for (const [key, label] of fields) {
    const left = normalizeLoose(a[key]);
    const right = normalizeLoose(b[key]);
    if (left && right && left !== right) {
      differences.push(`${label} differs (${a[key]} vs ${b[key]})`);
    }
  }

  return {
    equivalent: differences.length === 0,
    differences,
  };
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
