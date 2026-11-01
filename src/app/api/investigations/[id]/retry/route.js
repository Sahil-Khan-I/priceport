import { NextResponse } from "next/server";
import { loadInvestigation, updateInvestigation } from "@/lib/storage/file-store";
import { kick } from "@/lib/investigations/runner";
import { JOB_STATUS } from "@/lib/investigations/status";
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
    rec.jobs = rec.jobs.map((job) => {
      const shouldRetry =
        (jobIds ? jobIds.includes(job.id) : true) &&
        [JOB_STATUS.FAILED, JOB_STATUS.TIMED_OUT].includes(job.status) &&
        job.url &&
        job.goal;

      if (!shouldRetry) return job;

      return {
        ...job,
        status: JOB_STATUS.QUEUED,
        error: null,
        offer: null,
        raw: null,
        tinyfishRunId: null,
        streamingUrl: null,
        startedAt: null,
        finishedAt: null,
      };
    });

    rec.status = "queued";
    rec.events.push({
      id: `evt_${randomUUID().slice(0, 8)}`,
      type: "RETRY_REQUESTED",
      message: "Failed jobs re-queued",
      jobId: null,
      at: new Date().toISOString(),
    });
    return rec;
  });

  kick(id);
  return NextResponse.json({
    id: updated.id,
    status: updated.status,
    summary: updated.summary,
  });
}
