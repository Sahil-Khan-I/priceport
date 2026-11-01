/**
 * Job planning and terminal-state rules.
 * Closing a local TinyFish stream does not guarantee the remote browser stopped.
 */

const ACTIVE = new Set([
  "queued",
  "starting",
  "navigating",
  "searching",
  "extracting",
  "verifying",
]);

const TERMINAL = new Set(["completed", "failed", "timed_out", "unsupported", "cancelled", "interrupted"]);

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

/** A local abort is not a deadline timeout. Cancellation is explicit. */
export function classifyExecutionFailure(
  error: unknown,
  { cancelled = false }: { cancelled?: boolean } = {},
) {
  if (cancelled) {
    return {
      status: "cancelled" as const,
      message: "Stopped by you. Prices already found are kept.",
      eventType: "CANCELLED" as const,
    };
  }
  if (isAbortError(error)) {
    return {
      status: "failed" as const,
      message: "The local stream closed before TinyFish returned a result.",
      eventType: "ERROR" as const,
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
  const completed = scoped.filter((job) => job.status === "completed").length;
  const cancelled = scoped.filter((job) => job.status === "cancelled").length;
  const bad = scoped.filter((job) =>
    ["failed", "timed_out", "interrupted"].includes(job.status),
  ).length;
  if (completed > 0 && (bad > 0 || cancelled > 0)) return "partial";
  if (completed > 0) return "completed";
  if (cancelled > 0 && bad === 0) return "cancelled";
  return "failed";
}

function key(provider: string, market: string) {
  return `${provider.toLowerCase()}|${market.toUpperCase()}`;
}
