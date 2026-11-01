import { NextResponse } from "next/server";
import { createInvestigation } from "@/lib/investigations/runner";
import {
  getTrackIntelligence,
  loadTrack,
  saveTrack,
} from "@/lib/storage/observations-store";
import { isTinyFishConfigured } from "@/lib/tinyfish/config";

/**
 * Manual re-check for a tracked search.
 * Creates a new real investigation — does not invent prices.
 */
export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!isTinyFishConfigured()) {
    return NextResponse.json(
      {
        error:
          "TinyFish is not configured. Add your server-side API key to re-check prices.",
      },
      { status: 503 },
    );
  }

  const { id } = await context.params;
  const track = await loadTrack(id);
  if (!track) {
    return NextResponse.json({ error: "Track not found" }, { status: 404 });
  }

  const record = await createInvestigation({
    hotel: track.hotel,
    bookingDetails: track.bookingDetails,
    homeCountry: track.homeCountry,
    preferredCurrency: track.preferredCurrency || "USD",
    providers: track.providers,
    markets: track.markets,
    marketAccess: track.marketAccess || {},
  });

  track.lastCheckedAt = new Date().toISOString();
  track.lastInvestigationId = record.id;
  track.updatedAt = track.lastCheckedAt;
  track.note =
    "Background scheduling is not configured — this was a manual re-check that launched a new TinyFish investigation.";
  await saveTrack(track);

  return NextResponse.json({
    track,
    investigationId: record.id,
    status: record.status,
    monitoringNote: track.note,
    intelligence: await getTrackIntelligence(id),
  });
}
