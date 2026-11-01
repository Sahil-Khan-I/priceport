/**
 * Requested room context. Null means the traveller accepted any option.
 * These values are preferences, not a claim that a hotel uses the same labels.
 */

export const ROOM_CATEGORIES = [
  "standard",
  "superior",
  "deluxe",
  "premium",
  "executive",
  "junior_suite",
  "suite",
  "family",
  "apartment",
  "villa",
] as const;

export const BED_TYPES = ["king", "queen", "twin", "double", "single"] as const;

export const MEAL_PLANS = [
  "room_only",
  "breakfast",
  "half_board",
  "full_board",
  "all_inclusive",
] as const;

export const CANCELLATION_PREFERENCES = [
  "free_cancellation_preferred",
  "refundable_only",
  "non_refundable_ok",
] as const;

export const SMOKING_PREFERENCES = ["non_smoking", "smoking"] as const;
export const VIEW_PREFERENCES = ["sea", "city", "high_floor"] as const;

export const ROOM_CATEGORY_LABELS: Record<string, string> = {
  standard: "Standard room",
  superior: "Superior room",
  deluxe: "Deluxe room",
  premium: "Premium room",
  executive: "Executive room",
  junior_suite: "Junior suite",
  suite: "Suite",
  family: "Family room",
  apartment: "Apartment",
  villa: "Villa",
};

export const BED_LABELS: Record<string, string> = {
  king: "King bed",
  queen: "Queen bed",
  twin: "Twin beds",
  double: "Double bed",
  single: "Single bed",
};

export const MEAL_LABELS: Record<string, string> = {
  room_only: "Room only",
  breakfast: "Breakfast included",
  half_board: "Half board",
  full_board: "Full board",
  all_inclusive: "All-inclusive",
};

export const CANCELLATION_LABELS: Record<string, string> = {
  free_cancellation_preferred: "Free cancellation preferred",
  refundable_only: "Refundable only",
  non_refundable_ok: "Non-refundable acceptable",
};

export type RoomPreferences = {
  category: string | null;
  bedType: string | null;
  mealPlan: string | null;
  cancellationPreference: string | null;
  smoking: string | null;
  view: string | null;
  accessibility: boolean | null;
  connectingRooms: boolean | null;
};

export function validateGuestCounts({
  adults,
  children,
  childrenAges,
  rooms,
}: {
  adults: number;
  children: number;
  childrenAges: number[];
  rooms: number;
}) {
  const errors: string[] = [];
  if (!Number.isFinite(adults) || adults < 1) errors.push("adults must be >= 1");
  if (!Number.isFinite(children) || children < 0) errors.push("children must be >= 0");
  if (!Number.isFinite(rooms) || rooms < 1) errors.push("rooms must be >= 1");
  if (children > 0 && childrenAges.length !== children) {
    errors.push("childrenAges must be provided for each child");
  }
  if (childrenAges.some((age) => !Number.isFinite(age) || age < 0 || age > 17)) {
    errors.push("childrenAges must be between 0 and 17");
  }
  if (Number.isFinite(rooms) && Number.isFinite(adults) && rooms > adults) {
    errors.push("rooms cannot exceed adults");
  }
  return errors;
}

export function emptyRoomPreferences(): RoomPreferences {
  return {
    category: null,
    bedType: null,
    mealPlan: null,
    cancellationPreference: null,
    smoking: null,
    view: null,
    accessibility: null,
    connectingRooms: null,
  };
}

export function normalizeRoomPreferences(input: any): {
  ok: boolean;
  errors: string[];
  value: RoomPreferences;
} {
  const source = input && typeof input === "object" ? input : {};
  const errors: string[] = [];
  const value = emptyRoomPreferences();

  value.category = oneOf(source.category, ROOM_CATEGORIES, "room category", errors);
  value.bedType = oneOf(source.bedType, BED_TYPES, "bed type", errors);
  value.mealPlan = oneOf(source.mealPlan, MEAL_PLANS, "meal plan", errors);
  value.cancellationPreference = oneOf(
    source.cancellationPreference,
    CANCELLATION_PREFERENCES,
    "cancellation preference",
    errors,
  );
  value.smoking = oneOf(source.smoking, SMOKING_PREFERENCES, "smoking preference", errors);
  value.view = oneOf(source.view, VIEW_PREFERENCES, "view preference", errors);
  value.accessibility = boolOrNull(source.accessibility, "accessibility", errors);
  value.connectingRooms = boolOrNull(source.connectingRooms, "connecting rooms", errors);

  return { ok: errors.length === 0, errors, value };
}

export function describeRoomPreferences(preferences?: Partial<RoomPreferences> | null) {
  const prefs = preferences || {};
  const parts = [
    prefs.category ? ROOM_CATEGORY_LABELS[prefs.category] : "Any room",
    prefs.bedType ? BED_LABELS[prefs.bedType] : null,
    prefs.mealPlan ? MEAL_LABELS[prefs.mealPlan] : "Any meal plan",
    prefs.cancellationPreference
      ? CANCELLATION_LABELS[prefs.cancellationPreference]
      : null,
    prefs.smoking === "non_smoking" ? "Non-smoking" : null,
    prefs.view === "sea" ? "Sea view" : prefs.view === "city" ? "City view" : prefs.view === "high_floor" ? "High floor" : null,
    prefs.accessibility ? "Accessible room" : null,
    prefs.connectingRooms ? "Connecting rooms" : null,
  ].filter(Boolean);
  return parts.join(" · ");
}

export function roomPreferenceGoalLines(preferences?: Partial<RoomPreferences> | null) {
  const prefs = preferences || {};
  return [
    "Room preference:",
    `- Category: ${prefs.category ? ROOM_CATEGORY_LABELS[prefs.category] : "Any room"}`,
    `- Bed: ${prefs.bedType ? BED_LABELS[prefs.bedType] : "Any bed"}`,
    `- Meal plan: ${prefs.mealPlan ? MEAL_LABELS[prefs.mealPlan] : "Any meal plan"}`,
    `- Cancellation: ${prefs.cancellationPreference ? CANCELLATION_LABELS[prefs.cancellationPreference] : "Any policy"}`,
    prefs.smoking ? `- Smoking: ${prefs.smoking === "non_smoking" ? "Non-smoking" : "Smoking permitted"}` : null,
    prefs.view ? `- View or floor: ${prefs.view.replace(/_/g, " ")}` : null,
    prefs.accessibility ? "- Accessibility: required" : null,
    prefs.connectingRooms ? "- Connecting rooms: requested" : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function oneOf(
  value: unknown,
  allowed: readonly string[],
  label: string,
  errors: string[],
) {
  if (value == null || value === "" || value === "any") return null;
  const text = String(value).trim();
  if (!allowed.includes(text)) {
    errors.push(`Invalid ${label}`);
    return null;
  }
  return text;
}

function boolOrNull(value: unknown, label: string, errors: string[]) {
  if (value == null || value === "" || value === "any") return null;
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  errors.push(`Invalid ${label}`);
  return null;
}
