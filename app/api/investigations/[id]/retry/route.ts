import { NextResponse } from "next/server";
import { loadInvestigation, updateInvestigation } from "@/lib/storage/file-store";
import { kick } from "@/lib/investigations/runner";
import { planRetries } from "@/lib/investigations/lifecycle";
import { randomUUID } from "node:crypto";

export async function POST(request, context) {
  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const jobIds = Array.isArray(body.jobIds) ? body.jobIds : null;

  const existing = await loadInvestigation(id);
  if (!existing) {
    return NextResponse.json({ error: "Investigation not found" }, { status: 404 });
  }

  const updated = await updateInvestigation(id, (rec) => {
    const additions = planRetries(rec.jobs, jobIds).map((plan) => {
      const job = rec.jobs.find((item) => item.id === plan.replacesJobId);
      return {
        ...job,
        id: `job_${randomUUID().replace(/-/g, "").slice(0, 12)}`,
        status: plan.status,
        error: null,
        offer: null,
        raw: null,
        tinyfishRunId: null,
        streamingUrl: null,
        sourceUrl: job.url,
        startedAt: null,
        finishedAt: null,
        browserSessionStatus: "pending",
        extractionStatus: "pending",
        attempt: plan.attempt,
        replacesJobId: plan.replacesJobId,
      };
    });
    rec.jobs = [...rec.jobs, ...additions];
    if (additions.length) rec.status = "queued";
    rec.events.push({
      id: `evt_${randomUUID().slice(0, 8)}`,
      type: "RETRY_REQUESTED",
      message: "Failed jobs re-queued",
      jobId: null,
      at: new Date().toISOString(),
    });
    return rec;
  });

  if (updated.jobs.length > existing.jobs.length) kick(id);
  return NextResponse.json({
    id: updated.id,
    status: updated.status,
    summary: updated.summary,
  });
}
