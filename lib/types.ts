export type JobStatus =
  | "queued"
  | "starting"
  | "navigating"
  | "searching"
  | "extracting"
  | "verifying"
  | "completed"
  | "failed"
  | "timed_out"
  | "unsupported";

export type PropertyMatch =
  | "exact"
  | "probable"
  | "partial"
  | "unmatched"
  | "unknown";

export type TotalStatus =
  | "confirmed"
  | "partial"
  | "estimated"
  | "incomplete"
  | "unknown";

export type AccessMethod = "proxy" | "storefront" | "unsupported" | string;

export interface HotelInput {
  name: string;
  location?: string | null;
  address?: string | null;
  city?: string | null;
  propertyAddress?: string | null;
  providerUrl?: string | null;
  officialWebsite?: string | null;
  evidence?: string[];
  hotelName?: string;
}

export interface BookingDetails {
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  childrenAges: number[];
  rooms: number;
}

export interface MarketAccessContext {
  selected_market: string;
  actual_proxy_country: string | null;
  storefront_region: string | null;
  currency: string;
  access_method: AccessMethod;
  access_verified: boolean;
  enabled?: boolean;
  reason?: string | null;
}

export interface Offer {
  id: string | null;
  provider: string;
  providerUrl: string;
  hotelName: string;
  propertyAddress: string | null;
  propertyMatch: PropertyMatch | string;
  market: string;
  actualProxyCountry: string | null;
  storefrontRegion: string | null;
  accessMethod: AccessMethod;
  accessVerified: boolean;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  rooms: number;
  roomType: string | null;
  mealPlan: string | null;
  cancellationPolicy: string | null;
  basePrice: number | null;
  currency: string;
  taxes: number | null;
  mandatoryFees: number | null;
  estimatedFees: number | null;
  unknownFees: string[];
  totalPrice: number | null;
  totalStatus: TotalStatus | string;
  availability: string;
  eligibility: string[];
  sourceUrl: string;
  checkedAt: string;
  evidence: string[];
  tinyfishRunId: string;
  investigationStatus: string;
  conversion?: ConversionResult | null;
  trueCost?: TrueCostResult | null;
  bookable?: boolean;
  comparable?: boolean;
  raw?: unknown;
  [key: string]: unknown;
}

export interface ConversionResult {
  available: boolean;
  amount: number | null;
  rate: number | null;
  from: string | null;
  to: string | null;
  source: string | null;
  fetchedAt: string | null;
  reason?: string;
  originalAmount?: number | null;
  originalCurrency?: string | null;
}

export interface TrueCostResult {
  basePrice: number | null;
  taxes: number | null;
  mandatoryFees: number | null;
  estimatedFees: number | null;
  unknownFees: string[];
  providerDisplayedTotal?: number | null;
  derivedConfirmedTotal?: number | null;
  confirmedTotal: number | null;
  displayedTotal: number | null;
  estimatedTotal: number | null;
  totalStatus: TotalStatus | string;
  fullyComparable: boolean;
}

export interface InvestigationEvent {
  id: string;
  type: string;
  message: string;
  jobId?: string | null;
  at: string;
  payload?: unknown;
}

export interface InvestigationJob {
  id: string;
  provider: string;
  providerName: string;
  market: string;
  status: JobStatus | string;
  accessMethod: AccessMethod;
  actualProxyCountry: string | null;
  storefrontRegion: string | null;
  accessVerified: boolean;
  url: string | null;
  goal: string | null;
  outputSchema?: unknown;
  browserProfile?: string;
  requireProxy?: boolean;
  tinyfishRunId: string | null;
  streamingUrl: string | null;
  sourceUrl: string | null;
  error: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  offer: Offer | null;
  raw: unknown;
}

export interface InvestigationSummary {
  total: number;
  queued: number;
  running: number;
  completed: number;
  failed: number;
  unsupported: number;
}

export interface InvestigationRequest {
  hotel: HotelInput;
  bookingDetails: BookingDetails;
  homeCountry?: string | null;
  preferredCurrency?: string;
  providers: string[];
  markets: string[];
  marketAccess?: Record<string, string>;
}

export interface InvestigationRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: string;
  request: InvestigationRequest;
  jobs: InvestigationJob[];
  events: InvestigationEvent[];
  offers: Offer[];
  ranking: {
    lowestComparableId: string | null;
    cheapestBookableId: string | null;
    roomDiffNotes: unknown;
  } | null;
  summary: InvestigationSummary;
}

export interface HotelCandidate {
  id: string;
  name: string;
  location: string | null;
  address: string | null;
  providerUrl: string | null;
  officialWebsite: string | null;
  evidence: string[];
  snippet: string | null;
}

export type RouteContext = {
  params: Promise<{ id: string }>;
};
