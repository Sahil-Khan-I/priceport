import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  detectPriceMovement,
  observationKey,
  type PriceObservation,
} from "@/lib/pricing/observations";

const ROOT = path.join(process.cwd(), ".data");
const OBS_DIR = path.join(ROOT, "observations");
const TRACKS_DIR = path.join(ROOT, "tracks");

async function ensureDirs() {
  await fs.mkdir(OBS_DIR, { recursive: true });
  await fs.mkdir(TRACKS_DIR, { recursive: true });
}

function safeId(id: string) {
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw new Error("Invalid id");
  return id;
}

export async function saveObservation(observation: PriceObservation) {
  await ensureDirs();
  const id = observation.id || `obs_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
  const row = { ...observation, id };
  const target = path.join(OBS_DIR, `${safeId(id)}.json`);
  const tmp = `${target}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(row, null, 2), "utf8");
  await fs.rename(tmp, target);
  return row;
}

export async function listObservations(): Promise<PriceObservation[]> {
  await ensureDirs();
  const files = await fs.readdir(OBS_DIR);
  const rows: PriceObservation[] = [];
  for (const file of files.filter((f) => f.endsWith(".json"))) {
    try {
      const raw = await fs.readFile(path.join(OBS_DIR, file), "utf8");
      rows.push(JSON.parse(raw));
    } catch {
      // skip corrupt
    }
  }
  return rows.sort((a, b) =>
    String(b.checkedAt).localeCompare(String(a.checkedAt)),
  );
}

export async function findObservationsForOffer(
  offerLike: Partial<PriceObservation>,
) {
  const key = observationKey(offerLike);
  const all = await listObservations();
  return all.filter((o) => observationKey(o) === key);
}

export async function recordOfferObservation({
  offer,
  investigationId,
  trackId = null,
}: {
  offer: any;
  investigationId?: string | null;
  trackId?: string | null;
}) {
  if (!offer) return null;
  const observation: PriceObservation = {
    id: `obs_${randomUUID().replace(/-/g, "").slice(0, 12)}`,
    trackId,
    investigationId: investigationId || null,
    hotelName: offer.hotelName || "",
    hotelLocation: offer.propertyAddress || null,
    provider: offer.provider || "",
    market: offer.market || "",
    checkIn: offer.checkIn || "",
    checkOut: offer.checkOut || "",
    adults: Number(offer.adults ?? 0),
    children: Number(offer.children ?? 0),
    rooms: Number(offer.rooms ?? 1),
    roomType: offer.roomType || null,
    mealPlan: offer.mealPlan || null,
    cancellationPolicy: offer.cancellationPolicy || null,
    displayedTotal:
      offer.trueCost?.displayedTotal ?? offer.totalPrice ?? null,
    currency: offer.currency || null,
    totalStatus: offer.totalStatus || "unknown",
    propertyMatch: offer.propertyMatch || null,
    sourceUrl: offer.sourceUrl || null,
    tinyfishRunId: offer.tinyfishRunId || null,
    checkedAt: offer.checkedAt || new Date().toISOString(),
  };

  // Deduplicate identical consecutive snapshots within 2 minutes.
  const prior = await findObservationsForOffer(observation);
  const latest = prior[0];
  if (
    latest &&
    latest.displayedTotal === observation.displayedTotal &&
    latest.currency === observation.currency &&
    Math.abs(
      new Date(observation.checkedAt).getTime() -
        new Date(latest.checkedAt).getTime(),
    ) < 120_000
  ) {
    return latest;
  }

  return saveObservation(observation);
}

export type TrackedSearch = {
  id: string;
  createdAt: string;
  updatedAt: string;
  label: string;
  investigationId: string | null;
  hotel: any;
  bookingDetails: any;
  providers: string[];
  markets: string[];
  marketAccess?: Record<string, string>;
  homeCountry?: string | null;
  preferredCurrency?: string;
  lastCheckedAt: string | null;
  lastInvestigationId: string | null;
  monitoringMode: "manual";
  note: string;
};

export async function saveTrack(track: TrackedSearch) {
  await ensureDirs();
  const target = path.join(TRACKS_DIR, `${safeId(track.id)}.json`);
  const tmp = `${target}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(track, null, 2), "utf8");
  await fs.rename(tmp, target);
  return track;
}

export async function loadTrack(id: string): Promise<TrackedSearch | null> {
  try {
    const raw = await fs.readFile(
      path.join(TRACKS_DIR, `${safeId(id)}.json`),
      "utf8",
    );
    return JSON.parse(raw);
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: string }).code === "ENOENT"
    ) {
      return null;
    }
    throw error;
  }
}

export async function listTracks(): Promise<TrackedSearch[]> {
  await ensureDirs();
  const files = await fs.readdir(TRACKS_DIR);
  const rows: TrackedSearch[] = [];
  for (const file of files.filter((f) => f.endsWith(".json"))) {
    try {
      const raw = await fs.readFile(path.join(TRACKS_DIR, file), "utf8");
      rows.push(JSON.parse(raw));
    } catch {
      // skip
    }
  }
  return rows.sort((a, b) =>
    String(b.updatedAt).localeCompare(String(a.updatedAt)),
  );
}

export async function createTrackFromInvestigation(record: any) {
  const id = `trk_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
  const now = new Date().toISOString();
  const track: TrackedSearch = {
    id,
    createdAt: now,
    updatedAt: now,
    label: record.request?.hotel?.name || "Tracked search",
    investigationId: record.id,
    hotel: record.request.hotel,
    bookingDetails: record.request.bookingDetails,
    providers: record.request.providers,
    markets: record.request.markets,
    marketAccess: record.request.marketAccess,
    homeCountry: record.request.homeCountry,
    preferredCurrency: record.request.preferredCurrency,
    lastCheckedAt: now,
    lastInvestigationId: record.id,
    monitoringMode: "manual",
    note: "Background scheduling is not configured — re-check manually to refresh prices.",
  };
  await saveTrack(track);

  for (const job of record.jobs || []) {
    if (job.offer) {
      await recordOfferObservation({
        offer: job.offer,
        investigationId: record.id,
        trackId: track.id,
      });
    }
  }

  return track;
}

export async function getTrackIntelligence(trackId: string) {
  const track = await loadTrack(trackId);
  if (!track) return null;
  const all = await listObservations();
  const related = all.filter((o) => o.trackId === trackId);
  const byKey = new Map<string, PriceObservation[]>();
  for (const obs of related) {
    const key = observationKey(obs);
    const list = byKey.get(key) || [];
    list.push(obs);
    byKey.set(key, list);
  }

  const series = [...byKey.entries()].map(([key, observations]) => {
    const sorted = [...observations].sort((a, b) =>
      String(a.checkedAt).localeCompare(String(b.checkedAt)),
    );
    const previous = sorted.length >= 2 ? sorted[sorted.length - 2] : null;
    const current = sorted[sorted.length - 1] || null;
    return {
      key,
      observations: sorted,
      latest: current,
      movement: detectPriceMovement(previous, current),
    };
  });

  return {
    track,
    series,
    monitoringNote: track.note,
  };
}
