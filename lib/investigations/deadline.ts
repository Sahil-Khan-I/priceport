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

function key(provider: string, market: string) {
  return `${provider.toLowerCase()}|${market.toUpperCase()}`;
}
