import { NextResponse } from "next/server";
import { loadInvestigation } from "@/lib/storage/file-store";
import { rankOffers } from "@/lib/pricing/ranking";
import { formatMoney } from "@/lib/pricing/currency";

export async function GET(_request, context) {
  const { id } = await context.params;
  const record = await loadInvestigation(id);
  if (!record) {
    return NextResponse.json({ error: "Investigation not found" }, { status: 404 });
  }

  const offers = record.jobs.map((j) => j.offer).filter(Boolean);
  const ranking = await rankOffers(
    offers,
    record.request.preferredCurrency || "USD",
  );

  return NextResponse.json({
    id: record.id,
    status: record.status,
    request: record.request,
    summary: record.summary,
    offers: ranking.offers,
    lowestComparable: ranking.lowestComparable,
    cheapestBookable: ranking.cheapestBookable,
    roomDiffNotes: ranking.roomDiffNotes,
    formatHint: {
      currency: record.request.preferredCurrency || "USD",
      example: formatMoney(100, record.request.preferredCurrency || "USD"),
    },
    jobs: record.jobs.map((job) => ({
      id: job.id,
      providerName: job.providerName,
      market: job.market,
      status: job.status,
      accessMethod: job.accessMethod,
      actualProxyCountry: job.actualProxyCountry,
      tinyfishRunId: job.tinyfishRunId,
      error: job.error,
      sourceUrl: job.sourceUrl,
    })),
  });
}
