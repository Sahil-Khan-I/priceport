export function createEmptyOffer(partial = {}) {
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
    mealPlan: null,
    cancellationPolicy: null,

    basePrice: null,
    currency: "",

    taxes: null,
    mandatoryFees: null,
    estimatedFees: null,
    unknownFees: [],

    totalPrice: null,
    totalStatus: "incomplete",

    availability: "unknown",
    eligibility: [],

    sourceUrl: "",
    checkedAt: "",

    evidence: [],

    tinyfishRunId: "",
    investigationStatus: "",

    conversion: null,
    raw: null,
    ...partial,
  };
}

/**
 * TinyFish output_schema — use nullable:true, never type arrays.
 * https://docs.tinyfish.ai/key-concepts/structured-output
 */
export const OFFER_OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    hotelName: { type: "string" },
    propertyAddress: { type: "string", nullable: true },
    propertyMatch: {
      type: "string",
      enum: ["exact", "probable", "partial", "unmatched", "unknown"],
    },
    roomType: { type: "string", nullable: true },
    mealPlan: { type: "string", nullable: true },
    cancellationPolicy: { type: "string", nullable: true },
    basePrice: { type: "number", nullable: true },
    currency: { type: "string", nullable: true },
    taxes: { type: "number", nullable: true },
    mandatoryFees: { type: "number", nullable: true },
    estimatedFees: { type: "number", nullable: true },
    unknownFees: { type: "array", items: { type: "string" } },
    totalPrice: { type: "number", nullable: true },
    totalStatus: {
      type: "string",
      enum: ["confirmed", "partial", "estimated", "incomplete", "unknown"],
    },
    availability: {
      type: "string",
      enum: ["available", "unavailable", "limited", "unknown"],
    },
    eligibility: { type: "array", items: { type: "string" } },
    sourceUrl: { type: "string", nullable: true },
    evidence: { type: "array", items: { type: "string" } },
    notes: { type: "string", nullable: true },
  },
  required: ["hotelName", "propertyMatch", "availability"],
  propertyOrdering: [
    "hotelName",
    "propertyAddress",
    "propertyMatch",
    "roomType",
    "mealPlan",
    "cancellationPolicy",
    "basePrice",
    "currency",
    "taxes",
    "mandatoryFees",
    "estimatedFees",
    "unknownFees",
    "totalPrice",
    "totalStatus",
    "availability",
    "eligibility",
    "sourceUrl",
    "evidence",
    "notes",
  ],
};
