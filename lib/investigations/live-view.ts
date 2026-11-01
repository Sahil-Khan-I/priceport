/**
 * Pure helpers for the live investigation room.
 * Derived only from persisted jobs and events — no invented progress.
 */

const TERMINAL = new Set(["completed", "failed", "timed_out", "unsupported", "cancelled"]);
const RUNNING = new Set([
  "running",
  "starting",
  "in_progress",
  "navigating",
  "searching",
  "extracting",
  "verifying",
]);
const WAITING = new Set(["queued", "pending"]);

const STATUS_RANK: Record<string, number> = {
  deferred: 0,
  queued: 0,
  pending: 0,
  starting: 1,
  in_progress: 2,
  navigating: 2,
  searching: 2,
  extracting: 2,
  verifying: 2,
  running: 2,
  completed: 3,
  failed: 3,
  timed_out: 3,
  unsupported: 3,
  cancelled: 3,
};

export type LiveJob = {
  id: string;
  provider?: string;
  providerName?: string;
  market?: string;
  status?: string;
  accessMethod?: string | null;
  actualProxyCountry?: string | null;
  storefrontRegion?: string | null;
  error?: string | null;
  offer?: {
    id?: string;
    provider?: string;
    market?: string;
    totalPrice?: number | null;
    currency?: string | null;
    roomType?: string | null;
    mealPlan?: string | null;
    totalStatus?: string | null;
    verificationStatus?: string | null;
    propertyMatch?: string | null;
    conversion?: { available?: boolean; amount?: number | null; currency?: string } | null;
    sourceUrl?: string | null;
    availability?: string | null;
    roomMatch?: string | null;
  } | null;
  sourceUrl?: string | null;
  streamingUrl?: string | null;
  tinyfishRunId?: string | null;
  extractionStatus?: string | null;
};

export type LiveEvent = {
  id: string;
  type?: string;
  message?: string;
  at?: string;
  jobId?: string | null;
  payload?: unknown;
};

export function summarizeProgress(jobs: LiveJob[] = []) {
  const completed = jobs.filter((j) => j.status === "completed").length;
  const researching = jobs.filter((j) => RUNNING.has(String(j.status))).length;
  const waiting = jobs.filter((j) => WAITING.has(String(j.status))).length;
  const attention = jobs.filter((j) =>
    ["failed", "timed_out", "unsupported", "cancelled"].includes(String(j.status)),
  ).length;
  const terminal = jobs.filter((j) => TERMINAL.has(String(j.status))).length;
  const offers = jobs.filter((j) => hasOffer(j)).length;
  const comparable = jobs.filter((j) =>
    ["exact", "probable"].includes(String(j.offer?.propertyMatch || "")),
  ).length;
  const verified = jobs.filter((j) =>
    ["verified", "partially_verified"].includes(String(j.offer?.verificationStatus || "")),
  ).length;
  const providers = new Set(jobs.map((j) => j.providerName || j.provider)).size;
  const markets = new Set(jobs.map((j) => j.market).filter(Boolean)).size;

  return {
    total: jobs.length,
    completed,
    researching,
    waiting,
    attention,
    terminal,
    offers,
    comparable,
    providers,
    markets,
    verified,
    fraction: jobs.length ? terminal / jobs.length : 0,
  };
}

export function groupJobsByProvider(jobs: LiveJob[] = []) {
  const groups = new Map<string, LiveJob[]>();
  for (const job of jobs) {
    const key = job.providerName || job.provider || "Provider";
    const list = groups.get(key) || [];
    list.push(job);
    groups.set(key, list);
  }
  return [...groups.entries()].map(([provider, items]) => ({
    provider,
    jobs: items,
    completed: items.filter((j) => j.status === "completed").length,
    offers: items.filter((j) => hasOffer(j)).length,
    markets: items.length,
  }));
}

export function jobProgressLabel(job: LiveJob) {
  const provider = job.providerName || job.provider || "Provider";
  if (job.offer?.propertyMatch === "unmatched") return "Wrong hotel";
  if (job.extractionStatus === "unavailable" || job.offer?.availability === "unavailable" || job.offer?.roomMatch === "unavailable") {
    return "Unavailable";
  }
  if (job.status === "timed_out") return "Timed out";
  if (job.status === "unsupported") return "Unsupported";
  if (job.status === "failed") return "Check failed";
  if (job.status === "deferred") return `Later check · ${provider}`;
  if (job.offer?.totalPrice != null || job.offer?.currency) return "Price found";
  if (["queued", "starting", "navigating", "searching", "extracting", "verifying"].includes(String(job.status))) {
    return `Checking ${provider}`;
  }
  return job.status || "Waiting";
}

export function investigationStages(jobs: LiveJob[] = []) {
  const started = jobs.some((job) => !WAITING.has(String(job.status)));
  const extracting = jobs.some((job) =>
    ["extracting", "verifying", "completed"].includes(String(job.status)),
  );
  const offers = jobs.some((job) => hasOffer(job));
  const finished = jobs.length > 0 && jobs.every((job) => TERMINAL.has(String(job.status)));
  return [
    { id: "prepare", label: "Preparing hotel and stay details", complete: jobs.length > 0 },
    { id: "open", label: "Opening provider pages", complete: started },
    { id: "rooms", label: "Identifying matching room options", complete: extracting || offers },
    { id: "prices", label: "Extracting price and rate conditions", complete: offers },
    { id: "compare", label: "Comparing eligible offers", complete: finished },
  ];
}

export function accessLabel(job: {
  accessMethod?: string | null;
  actualProxyCountry?: string | null;
  storefrontRegion?: string | null;
}) {
  const method = String(job.accessMethod || "").toLowerCase();
  if (method.includes("proxy") || job.actualProxyCountry) {
    const country = job.actualProxyCountry || "country not confirmed";
    return `Residential proxy · ${country}`;
  }
  if (method.includes("storefront") || job.storefrontRegion) {
    return `Storefront · ${job.storefrontRegion || "region not confirmed"}`;
  }
  if (method.includes("unsupported")) return "Unsupported";
  return job.accessMethod || "Access unknown";
}

export function describeEvent(event: LiveEvent, jobs: LiveJob[] = []) {
  const job = jobs.find((j) => j.id === event.jobId);
  const who = job?.providerName || job?.provider || "A provider";
  const type = String(event.type || "");

  if (type === "HEARTBEAT") return null;
  if (type === "INVESTIGATION_CREATED") {
    return "Priceport started the investigation.";
  }
  if (type === "STARTED") {
    return `Checking ${who}${job?.market ? ` — ${job.market}` : ""}.`;
  }
  if (type === "STREAMING_URL") return null;
  if (type === "COMPLETE") {
    if (job?.extractionStatus === "unavailable" || job?.offer?.availability === "unavailable" || job?.offer?.roomMatch === "unavailable") {
      return `Unavailable on ${who}.`;
    }
    if (job && hasOffer(job)) return `Price found on ${who}.`;
    if (job?.status === "failed" || /fail/i.test(event.message || "")) {
      return `${who} could not find a price.`;
    }
    return `${who} finished this check.`;
  }
  if (type === "PROGRESS") {
    return milestoneLabel(String(event.message || ""), who);
  }
  if (type === "INVESTIGATION_EXPANDED") {
    return "Priceport started a wider comparison.";
  }
  if (event.message) return event.message;
  return null;
}

export function collapseActivity(
  lines: Array<{ id: string; text: string | null }>,
) {
  const out: Array<{ id: string; text: string }> = [];
  for (const line of lines) {
    if (!line.text) continue;
    if (out[out.length - 1]?.text === line.text) continue;
    out.push({ id: line.id, text: line.text });
  }
  return out;
}

function milestoneLabel(purpose: string, who: string) {
  const text = purpose.trim().toLowerCase();
  if (!text || text === "progress" || text === "heartbeat") return null;
  if (/price|rate|extract|total|night/.test(text)) return `${who} is extracting the price.`;
  if (/room|availab/.test(text)) return `${who} is matching the room.`;
  if (/hotel|property|search/.test(text)) return `${who} is identifying the hotel.`;
  if (/open|navigat|page/.test(text)) return `Checking ${who}.`;
  return null;
}

export function dedupeEvents(events: LiveEvent[] = []) {
  const seen = new Set<string>();
  const out: LiveEvent[] = [];
  for (const event of events) {
    if (!event?.id || seen.has(event.id)) continue;
    seen.add(event.id);
    out.push(event);
  }
  return out;
}

export function mergeJobs(current: LiveJob[] = [], incoming: LiveJob[] = []) {
  const map = new Map<string, LiveJob>();
  for (const job of current) map.set(job.id, job);
  for (const job of incoming) {
    const prev = map.get(job.id);
    if (!prev) {
      map.set(job.id, job);
      continue;
    }
    const prevRank = STATUS_RANK[String(prev.status)] ?? 0;
    const nextRank = STATUS_RANK[String(job.status)] ?? 0;
    const newer = nextRank >= prevRank ? job : prev;
    const older = newer === job ? prev : job;
    map.set(job.id, {
      ...older,
      ...newer,
      offer: newer.offer || older.offer || null,
      streamingUrl: newer.streamingUrl || older.streamingUrl || null,
      sourceUrl: newer.sourceUrl || older.sourceUrl || null,
      error: newer.error || older.error || null,
      tinyfishRunId: newer.tinyfishRunId || older.tinyfishRunId || null,
    });
  }
  return [...map.values()];
}

export function derivePriceInsights(jobs: LiveJob[] = []) {
  const insights: string[] = [];
  const offers = jobs
    .map((job) => ({ job, offer: job.offer }))
    .filter((row) => row.offer && row.offer.totalPrice != null);

  const byProvider = new Map<string, typeof offers>();
  for (const row of offers) {
    const key = row.job.providerName || row.job.provider || "Provider";
    const list = byProvider.get(key) || [];
    list.push(row);
    byProvider.set(key, list);
  }

  for (const [provider, rows] of byProvider) {
    const priced = rows.filter(
      (row) =>
        row.offer?.currency &&
        row.offer.totalPrice != null &&
        rows.every((other) => other.offer?.currency === row.offer?.currency) &&
        new Set(rows.map((r) => r.job.market)).size > 1,
    );
    if (priced.length < 2) continue;
    const sorted = [...priced].sort(
      (a, b) => Number(a.offer?.totalPrice) - Number(b.offer?.totalPrice),
    );
    const low = sorted[0];
    const high = sorted[sorted.length - 1];
    if (
      low.job.market !== high.job.market &&
      Number(low.offer?.totalPrice) < Number(high.offer?.totalPrice)
    ) {
      insights.push(
        `${provider} displayed a lower ${low.offer?.currency} price in the ${low.job.market} market context than in ${high.job.market}. These are extracted displayed amounts, not a confirmed reason for the difference.`,
      );
    }
  }

  const incomplete = offers.filter((row) => {
    const status = String(row.offer?.totalStatus || "").toLowerCase();
    return status && status !== "confirmed" && status !== "complete";
  });
  if (incomplete.length) {
    insights.push(
      "At least one displayed offer does not include a confirmed final fee breakdown.",
    );
  }

  const comparable = offers.filter((row) =>
    ["exact", "probable"].includes(String(row.offer?.propertyMatch || "")),
  );
  if (comparable.length >= 2) {
    insights.push("Two or more providers returned offers that look like the same property.");
  }

  return insights.slice(0, 3);
}

function hasOffer(job: LiveJob) {
  return job.offer?.totalPrice != null || job.offer?.verificationStatus != null;
}

export function isTerminalInvestigation(status: string | undefined) {
  return ["completed", "failed", "partial", "cancelled"].includes(String(status));
}
