/**
 * Evidence-backed eligibility assessment.
 * Missing restriction language is NOT proof that no restrictions exist.
 */

export type EligibilityStatus =
  | "verified_eligible"
  | "restriction_detected"
  | "eligibility_unclear"
  | "not_checked";

const RESTRICTION_PATTERNS: Array<{ code: string; re: RegExp }> = [
  { code: "residency", re: /resident|residency|local rate|domestic rate/i },
  { code: "nationality", re: /nationalit|citizen|passport/i },
  { code: "member_only", re: /member[-\s]?only|login required|account required|genius|vip/i },
  { code: "payment", re: /local card|credit card issued|payment method|prepaid only/i },
  { code: "non_refundable", re: /non[-\s]?refundable|no refund/i },
  { code: "prepayment", re: /prepay|pay now|full payment required/i },
  { code: "geo_block", re: /not available (in|to)|cannot book|restricted (to|for)/i },
];

export function assessEligibility(
  offer: any = {},
  context: { homeCountry?: string | null } = {},
) {
  const notes: string[] = [];
  const restrictions: string[] = [];
  const evidence: string[] = [];

  const eligibilityNotes = Array.isArray(offer.eligibility)
    ? offer.eligibility.map(String).filter(Boolean)
    : [];
  const blob = [
    ...eligibilityNotes,
    offer.cancellationPolicy,
    offer.prepayment,
    offer.notes,
    ...(Array.isArray(offer.evidence) ? offer.evidence : []),
  ]
    .filter(Boolean)
    .join(" · ");

  if (offer.availability === "unavailable") {
    notes.push("Offer marked unavailable");
    restrictions.push("unavailable");
  }

  for (const note of eligibilityNotes) {
    notes.push(note);
    evidence.push(note);
  }

  for (const { code, re } of RESTRICTION_PATTERNS) {
    if (re.test(blob)) {
      restrictions.push(code);
      evidence.push(`Detected ${code} language in extracted text`);
    }
  }

  if (context.homeCountry && /resident|residency|local rate/i.test(blob)) {
    notes.push(
      `Residency language found; traveler home country is ${context.homeCountry} — verify before booking`,
    );
  }

  let status: EligibilityStatus = "not_checked";
  if (restrictions.includes("unavailable")) {
    status = "restriction_detected";
  } else if (restrictions.length > 0) {
    status = "restriction_detected";
  } else if (eligibilityNotes.length > 0 || blob.length > 40) {
    // Agent returned eligibility/evidence text without clear restriction cues.
    status = "verified_eligible";
    notes.push(
      "No clear restriction language detected in extracted text — payment success is still not proven",
    );
  } else {
    status = "eligibility_unclear";
    notes.push(
      "Eligibility was not clearly verified on the booking page",
    );
  }

  const bookable =
    offer.availability === "available" &&
    status !== "restriction_detected" &&
    ["exact", "probable"].includes(String(offer.propertyMatch));

  return {
    status,
    bookable,
    notes,
    restrictions: [...new Set(restrictions)],
    evidence,
  };
}
