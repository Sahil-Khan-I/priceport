/**
 * Initial comparison budget.
 * Aborting the local stream stops Priceport from waiting.
 * It does not guarantee the remote TinyFish run is cancelled.
 */

const ACTIVE = new Set([
  "queued",
  "starting",
  "navigating",
  "searching",
  "extracting",
  "verifying",
]);

const TERMINAL = new Set(["completed", "failed", "timed_out", "unsupported", "cancelled"]);

export function planSearchPairs(providers: string[] = [], markets: string[] = []) {
  const uniqueProviders = [...new Set(providers.map((item) => String(item || "").trim()).filter(Boolean))];
  const uniqueMarkets = [...new Set(markets.map((item) => String(item || "").trim()).filter(Boolean))];
  const primary = uniqueMarkets[0] || null;
  const initialProviders = uniqueProviders.slice(0, 2);
  const initial = primary
    ? initialProviders.map((provider) => ({ provider, market: primary, stage: "initial" as const }))
    : [];
  const initialKeys = new Set(initial.map((pair) => key(pair.provider, pair.market)));
  const deferred: Array<{ provider: string; market: string; stage: "deferred" }> = [];
  for (const provider of uniqueProviders) {
    for (const market of uniqueMarkets) {
      if (initialKeys.has(key(provider, market))) continue;
      deferred.push({ provider, market, stage: "deferred" });
    }
  }
  return { primaryMarket: primary, initial, deferred };
}

export function applyDeadline(jobs: any[] = []) {
  let changed = false;
  const next = jobs.map((job) => {
    if (job.stage === "deferred" || job.status === "deferred") return job;
    if (job.stage === "expanded") return job;
    if (TERMINAL.has(job.status)) return job;
    changed = true;
    const queued = job.status === "queued";
    return {
      ...job,
      status: "timed_out",
      finishedAt: job.finishedAt || new Date().toISOString(),
      error: queued
        ? "Not started. The 2-minute comparison deadline passed."
        : "Stopped at the 2-minute deadline. Any price already found is kept.",
    };
  });
  return { jobs: next, changed };
}

export function canReplaceJobStatus(current: string, next?: string | null) {
  if (!next || next === current) return true;
  if (TERMINAL.has(current)) return false;
  return true;
}

export function shouldFinalize(jobs: any[] = [], finalizedAt?: string | null) {
  if (finalizedAt) return false;
  return !jobs.some((job) => ACTIVE.has(job.status));
}

export function isBlockingStatus(status: string) {
  return ACTIVE.has(status);
}

export function isAbortError(error: unknown) {
  if (!error) return false;
  const name = typeof error === "object" && "name" in error ? String((error as { name?: string }).name) : "";
  const message = error instanceof Error ? error.message : String(error);
  return name === "AbortError" || /operation was aborted|aborted/i.test(message);
}

/** Deadline and local aborts are timeouts. Other errors stay provider failures. */
export function classifyExecutionFailure(
  error: unknown,
  { deadlineAbort = false }: { deadlineAbort?: boolean } = {},
) {
  if (deadlineAbort || isAbortError(error)) {
    return {
      status: "timed_out" as const,
      message: "Stopped at the 2-minute deadline. Any price already found is kept.",
      eventType: "TIMEOUT" as const,
    };
  }
  return {
    status: "failed" as const,
    message: error instanceof Error ? error.message : "Agent execution failed",
    eventType: "ERROR" as const,
  };
}

export function deriveInvestigationStatus(jobs: any[] = []) {
  const scoped = jobs.filter((job) => job.status !== "deferred" && job.stage !== "deferred");
  if (scoped.some((job) => ACTIVE.has(job.status))) return "running";
  const usable = scoped.filter((job) => job.status === "completed").length;
  const bad = scoped.filter((job) => job.status === "failed" || job.status === "timed_out").length;
  if (usable > 0 && bad > 0) return "partial";
  if (usable > 0) return "completed";
  return "failed";
}

export function formatComparisonClock({
  startedAt,
  now,
  deadlineAt,
  finalizedAt,
}: {
  startedAt?: string | null;
  now: number;
  deadlineAt?: string | null;
  finalizedAt?: string | null;
}) {
  const start = Date.parse(startedAt || "");
  if (!Number.isFinite(start)) return "0:00";
  const deadline = Number.isFinite(Date.parse(deadlineAt || ""))
    ? Date.parse(deadlineAt || "")
    : start + 120_000;
  const frozen = finalizedAt ? Date.parse(finalizedAt) : now;
  const end = Math.min(deadline, Number.isFinite(frozen) ? frozen : now);
  const seconds = Math.min(120, Math.max(0, Math.round((end - start) / 1000)));
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

function key(provider: string, market: string) {
  return `${provider.toLowerCase()}|${market.toUpperCase()}`;
}
