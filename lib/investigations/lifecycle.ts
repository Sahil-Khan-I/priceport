import { explicitUnavailable } from "#unavailable";

const ACTIVE = new Set([
  "queued",
  "starting",
  "navigating",
  "searching",
  "extracting",
  "verifying",
]);

/** A closed browser is not a finished price check. */
export function resolveStreamOutcome(completePayload: any) {
  if (!completePayload) {
    return {
      status: "timed_out",
      extractionStatus: "failed",
      browserSessionStatus: "finished",
      error:
        "The provider stream closed before a result arrived. The browser ending is not a completed price check.",
    };
  }
  const runStatus = String(completePayload.status || "").toUpperCase();
  if (runStatus !== "COMPLETED") {
    return {
      status: "failed",
      extractionStatus: "failed",
      browserSessionStatus: "finished",
      error:
        completePayload?.error?.message ||
        "The browser run finished without a successful extraction.",
    };
  }
  return {
      status: "completed",
    extractionStatus: "extracted",
    browserSessionStatus: "finished",
    error: null,
  };
}

export function planRetries(jobs: any[] = [], jobIds: string[] | null = null) {
  const additions: any[] = [];
  for (const job of jobs) {
    if (explicitUnavailable(job) || explicitUnavailable(job.offer)) continue;
    const selected = jobIds ? jobIds.includes(job.id) : true;
    const retryable =
      selected &&
      [ "failed", "timed_out"].includes(job.status) &&
      job.url &&
      job.goal;
    if (!retryable) continue;
    const alreadyActive = [...jobs, ...additions].some(
      (other) =>
        other.provider === job.provider &&
        other.market === job.market &&
        other.stage === job.stage &&
        ACTIVE.has(other.status),
    );
    if (alreadyActive) continue;
    additions.push({
      provider: job.provider,
      market: job.market,
      stage: job.stage,
      url: job.url,
      goal: job.goal,
      replacesJobId: job.id,
      attempt: Number(job.attempt || 1) + 1,
      status: "queued",
    });
  }
  return additions;
}
