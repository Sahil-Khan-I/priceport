export function createEmptyOffer(partial: Record<string, any> = {}) {
  return {
    id: partial.id || null,
    provider: "",
    providerUrl: "",
    hotelName: "",
    propertyAddress: "",
    propertyMatch: "unknown",

    market: "",
    actualProxyCountry: null,
    storefrontRegion: null,
    accessMethod: "",
    accessVerified: false,

    checkIn: "",
    checkOut: "",
    adults: 2,
    children: 0,
    rooms: 1,

    roomType: null,
    bedConfiguration: null,
    mealPlan: null,
    cancellationPolicy: null,
    refundable: null,
    freeCancellationUntil: null,
    prepayment: null,

    roomMatch: "unknown",
    mealPlanStatus: "unknown",
    cancellationStatus: "unknown",
    comparisonClass: "insufficient_data",
    priceBasis: "unknown",
    nightlyPrice: null,
    estimatedStayTotal: null,
    displayedUnscoped: null,
    priceNote: null,

    basePrice: null,
    currency: "",

    taxes: null,
    mandatoryFees: null,
    estimatedFees: null,
    optionalFees: null,
    unknownFees: [] as string[],

    totalPrice: null,
    totalStatus: "incomplete",

    availability: "unknown",
    eligibility: [] as string[],
    eligibilityAssessment: {
      status: "not_checked",
      bookable: false,
      notes: [] as string[],
      restrictions: [] as string[],
    },
    verificationStatus: "unknown",
    bookingRisk: {
      level: "unknown",
      summary: "Risk not assessed",
      warnings: [] as Array<{ code: string; message: string; evidence?: string }>,
    },

    sourceUrl: "",
    checkedAt: "",

    evidence: [] as string[],
    missingFields: [] as string[],

    tinyfishRunId: "",
    investigationStatus: "",

    conversion: null,
    raw: null,
    ...partial,
  };
}

/**
 * Fast price-check schema sent to TinyFish.
 * The stored offer model stays richer so older investigations still load.
 */
export const OFFER_OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    hotelName: { type: "string" },
    propertyMatch: {
      type: "string",
      enum: ["exact", "probable", "partial", "unmatched", "unknown"],
    },
    roomType: { type: "string", nullable: true },
    roomMatch: {
      type: "string",
      enum: ["exact", "similar", "different", "unavailable", "unknown"],
      nullable: true,
    },
    availability: {
      type: "string",
      enum: ["available", "unavailable", "limited", "unknown"],
    },
    displayedPrice: { type: "number", nullable: true },
    currency: { type: "string", nullable: true },
    priceBasis: {
      type: "string",
      enum: ["per_night", "per_room_per_night", "total_stay", "per_person", "unknown"],
    },
    nightlyPrice: { type: "number", nullable: true },
    totalPrice: { type: "number", nullable: true },
    sourceUrl: { type: "string", nullable: true },
    evidence: { type: "array", items: { type: "string" } },
    notes: { type: "string", nullable: true },
  },
  required: ["hotelName", "propertyMatch", "availability"],
  propertyOrdering: [
    "hotelName",
    "propertyMatch",
    "roomType",
    "roomMatch",
    "availability",
    "displayedPrice",
    "currency",
    "priceBasis",
    "nightlyPrice",
    "totalPrice",
    "sourceUrl",
    "evidence",
    "notes",
  ],
};
