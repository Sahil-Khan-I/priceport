import { NextResponse } from "next/server";
import { loadInvestigation } from "@/lib/storage/file-store";
import { rankOffers } from "@/lib/pricing/ranking";
import { formatMoney } from "@/lib/pricing/currency";
import {
  findObservationsForOffer,
  listTracks,
} from "@/lib/storage/observations-store";
import { detectPriceMovement } from "@/lib/pricing/observations";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const record = await loadInvestigation(id);
  if (!record) {
    return NextResponse.json({ error: "Investigation not found" }, { status: 404 });
  }

  const offers = record.jobs.map((j: any) => j.offer).filter(Boolean);
  const ranking = await rankOffers(
    offers,
    record.request.preferredCurrency || "USD",
    { homeCountry: record.request.homeCountry || null },
  );

  const priceIntelligence: any[] = [];
  for (const offer of ranking.offers) {
    const history = await findObservationsForOffer(offer);
    const previous = history.length >= 2 ? history[1] : null;
    const current = history[0] || null;
    priceIntelligence.push({
      offerId: offer.id,
      observationCount: history.length,
      latest: current,
      previous,
      movement: detectPriceMovement(previous, current),
      history: history.slice(0, 10),
    });
  }

  const tracks = await listTracks();
  const relatedTrack =
    tracks.find((t) => t.investigationId === id || t.lastInvestigationId === id) ||
    null;

  return NextResponse.json({
    id: record.id,
    status: record.status,
    request: record.request,
    summary: record.summary,
    offers: ranking.offers,
    lowestComparable: ranking.lowestComparable,
    cheapestBookable: ranking.cheapestBookable,
    lowestDisplayed: ranking.lowestDisplayed,
    bestVerified: ranking.bestVerified,
    decision: ranking.decision,
    roomDiffNotes: ranking.roomDiffNotes,
    priceIntelligence,
    track: relatedTrack
      ? {
          id: relatedTrack.id,
          label: relatedTrack.label,
          monitoringMode: relatedTrack.monitoringMode,
          note: relatedTrack.note,
          lastCheckedAt: relatedTrack.lastCheckedAt,
        }
      : null,
    formatHint: {
      currency: record.request.preferredCurrency || "USD",
      example: formatMoney(100, record.request.preferredCurrency || "USD"),
    },
    jobs: record.jobs.map((job: any) => ({
      id: job.id,
      providerName: job.providerName,
      market: job.market,
      status: job.status,
      accessMethod: job.accessMethod,
      actualProxyCountry: job.actualProxyCountry,
      storefrontRegion: job.storefrontRegion,
      tinyfishRunId: job.tinyfishRunId,
      error: job.error,
      sourceUrl: job.sourceUrl,
    })),
  });
}
