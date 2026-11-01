import { NextResponse } from "next/server";
import { loadInvestigation } from "@/lib/storage/file-store";
import { kick } from "@/lib/investigations/runner";

export async function GET(_request, context) {
  const { id } = await context.params;
  const record = await loadInvestigation(id);
  if (!record) {
    return NextResponse.json({ error: "Investigation not found" }, { status: 404 });
  }

  // Resume only if queued jobs remain (avoid re-entering an in-flight run).
  const hasQueued = record.jobs?.some((job) => job.status === "queued" && job.stage !== "deferred");
  const deadlineAt = Date.parse(record.deadlineAt || "");
  if (!record.finalizedAt && hasQueued && (!Number.isFinite(deadlineAt) || Date.now() < deadlineAt)) {
    kick(id);
  }

  return NextResponse.json({
    id: record.id,
    status: record.status,
    createdAt: record.createdAt,
    deadlineAt: record.deadlineAt,
    finalizedAt: record.finalizedAt,
    updatedAt: record.updatedAt,
    request: record.request,
    summary: record.summary,
    jobs: record.jobs.map((job) => ({
      id: job.id,
      provider: job.provider,
      providerName: job.providerName,
      market: job.market,
      status: job.status,
      accessMethod: job.accessMethod,
      actualProxyCountry: job.actualProxyCountry,
      storefrontRegion: job.storefrontRegion,
      accessVerified: job.accessVerified,
      tinyfishRunId: job.tinyfishRunId,
      streamingUrl: job.streamingUrl,
      sourceUrl: job.sourceUrl,
      error: job.error,
      startedAt: job.startedAt,
      finishedAt: job.finishedAt,
      extractionStatus: job.extractionStatus,
      offer: job.offer,
    })),
    events: record.events.slice(-100),
  });
}
