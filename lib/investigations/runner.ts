import { randomUUID } from "node:crypto";
import { isTinyFishConfigured } from "@/lib/tinyfish/config";
import { streamInvestigationAgent } from "@/lib/tinyfish/agent";
import { getProviderAdapter } from "@/lib/providers/provider-registry";
import { resolveMarketAccess } from "@/lib/markets/config";
import {
  loadInvestigation,
  saveInvestigation,
  updateInvestigation,
} from "@/lib/storage/file-store";
import { agentQueue } from "./queue";
import { normalizeJobOffer } from "./normalize-offer";
import { rankOffers } from "@/lib/pricing/ranking";
import { recordOfferObservation } from "@/lib/storage/observations-store";
import { resolveStreamOutcome } from "./lifecycle";
import { explicitUnavailable } from "#unavailable";
import { expandPairs, filterNewPairs, pairKey } from "./job-plan";
import {
  applyDeadline,
  canReplaceJobStatus,
  planSearchPairs,
  shouldFinalize,
} from "./deadline";
import { INVESTIGATION_DEADLINE_MS, JOB_STATUS, JOB_TIMEOUT_MS, mapTinyFishEventToStatus } from "./status";
import { getMarket } from "@/lib/markets/config";

const running = new Set();
const liveAborts = new Map();

export async function createInvestigation(input: any) {
  if (!isTinyFishConfigured()) {
    const err = new Error(
      "TinyFish is not configured. Add your server-side API key to enable live investigations.",
    ) as Error & { code?: string };
    err.code = "TINYFISH_CONFIG";
    throw err;
  }

  const id = `inv_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
  const plan = planSearchPairs(input.providers || [], input.markets || []);
  const startedAt = new Date();
  const deadlineAt = new Date(startedAt.getTime() + INVESTIGATION_DEADLINE_MS).toISOString();
  const jobs = [
    ...materializePlanned(plan.initial, {
      marketAccess: input.marketAccess,
      hotel: input.hotel,
      bookingDetails: input.bookingDetails,
      status: JOB_STATUS.QUEUED,
    }),
    ...materializePlanned(plan.deferred, {
      marketAccess: input.marketAccess,
      hotel: input.hotel,
      bookingDetails: input.bookingDetails,
      status: JOB_STATUS.DEFERRED,
    }),
  ];

  const record = {
    id,
    createdAt: startedAt.toISOString(),
    updatedAt: startedAt.toISOString(),
    status: "queued",
    stage: "initial",
    deadlineAt,
    finalizedAt: null,
    request: input,
    timings: {
      requestReceivedAt: input.receivedAt || new Date().toISOString(),
      jobsCreatedAt: new Date().toISOString(),
      jobCount: jobs.length,
    },
    jobs,
    events: [
      {
        id: `evt_${randomUUID().slice(0, 8)}`,
        type: "INVESTIGATION_CREATED",
        message: `Checking ${plan.initial.length} provider${plan.initial.length === 1 ? "" : "s"} first. ${plan.deferred.length} later market check${plan.deferred.length === 1 ? "" : "s"} saved.`,
        jobId: null,
        at: new Date().toISOString(),
      },
    ],
    offers: [],
    ranking: null,
    summary: summarize(jobs),
  };

  await saveInvestigation(record);
  logTiming("investigation_created", {
    investigationId: id,
    jobs: jobs.length,
    providers: input.providers?.length || 0,
    markets: input.markets?.length || 0,
  });
  kick(id);
  return record;
}

export async function expandInvestigation(id: string) {
  const record = await loadInvestigation(id);
  if (!record) {
    const err = new Error("Investigation not found") as Error & { status?: number };
    err.status = 404;
    throw err;
  }

  const currentProviders = [
    ...new Set(record.jobs.map((job) => job.provider).filter(Boolean)),
  ] as string[];
  const currentMarkets = [
    ...new Set(record.jobs.map((job) => job.market).filter(Boolean)),
  ] as string[];
  const extraProviders = ["expedia"].filter(
    (provider) => !currentProviders.includes(provider),
  );
  const hotel = record.request?.hotel;
  if (
    (hotel?.officialWebsite || hotel?.providerUrl) &&
    !currentProviders.includes("official")
  ) {
    extraProviders.push("official");
  }

  const extraMarkets: string[] = [];
  const destinationCode = String(
    record.request?.destinationCountryCode || "",
  ).toUpperCase();
  if (
    destinationCode &&
    getMarket(destinationCode) &&
    !currentMarkets.includes(destinationCode)
  ) {
    extraMarkets.push(destinationCode);
  } else {
    const nextProxy = ["DE", "FR", "CA", "JP", "AU", "GB", "US"].find(
      (code) => getMarket(code)?.proxySupported && !currentMarkets.includes(code),
    );
    if (nextProxy) extraMarkets.push(nextProxy);
  }

  const pairs = expandPairs({
    currentProviders,
    currentMarkets,
    extraProviders,
    extraMarkets,
  });
  const freshPairs = filterNewPairs(
    record.jobs.map((job) => ({ provider: job.provider, market: job.market })),
    pairs,
  );

  const hasDeferred = record.jobs.some((job) => job.status === JOB_STATUS.DEFERRED);
  if (!freshPairs.length && !hasDeferred) {
    return { record, added: 0 };
  }

  const created = materializeJobs({
    providers: [...new Set(freshPairs.map((pair) => pair.provider))],
    markets: [...new Set(freshPairs.map((pair) => pair.market))],
    marketAccess: record.request?.marketAccess,
    hotel: record.request?.hotel,
    bookingDetails: record.request?.bookingDetails,
    stage: "expanded",
  }).filter((job) =>
    freshPairs.some((pair) => pairKey(pair.provider, pair.market) === pairKey(job.provider, job.market)),
  );

  const updated = await updateInvestigation(id, (rec) => {
    for (const job of rec.jobs) {
      if (job.status === JOB_STATUS.DEFERRED) {
        job.status = JOB_STATUS.QUEUED;
        job.stage = "expanded";
        job.error = null;
      }
    }
    const seen = new Set(rec.jobs.map((job) => pairKey(job.provider, job.market)));
    for (const job of created) {
      const key = pairKey(job.provider, job.market);
      if (seen.has(key)) continue;
      seen.add(key);
      rec.jobs.push(job);
    }
    rec.stage = "expanded";
    rec.status = "running";
    rec.finalizedAt = null;
    rec.summary = summarize(rec.jobs);
    rec.events.push({
      id: `evt_${randomUUID().slice(0, 8)}`,
      type: "INVESTIGATION_EXPANDED",
      message: `Added ${created.length} more investigation(s)`,
      jobId: null,
      at: new Date().toISOString(),
    });
    return rec;
  });

  const queuedIds = (updated?.jobs || [])
    .filter((job) => job.status === JOB_STATUS.QUEUED)
    .map((job) => job.id);

  void Promise.all(
    queuedIds.map((jobId) => agentQueue.push(() => executeJob(id, jobId))),
  )
    .then(() => finalizeInvestigation(id))
    .catch(async (error) => {
      await pushEvent(id, {
        type: "INVESTIGATION_FAILED",
        message: error instanceof Error ? error.message : "Expand failed",
        jobId: null,
      });
    });

  return { record: updated, added: created.length };
}

function materializePlanned(
  pairs: Array<{ provider: string; market: string; stage: "initial" | "deferred" | "expanded" }>,
  {
    marketAccess,
    hotel,
    bookingDetails,
    status,
  }: {
    marketAccess?: Record<string, string>;
    hotel: any;
    bookingDetails: any;
    status: string;
  },
) {
  return materializeJobs({
    providers: [...new Set(pairs.map((pair) => pair.provider))],
    markets: [...new Set(pairs.map((pair) => pair.market))],
    marketAccess,
    hotel,
    bookingDetails,
    stage: pairs[0]?.stage === "deferred" ? "deferred" : pairs[0]?.stage === "expanded" ? "expanded" : "initial",
  })
    .filter((job) =>
      pairs.some((pair) => pairKey(pair.provider, pair.market) === pairKey(job.provider, job.market)),
    )
    .map((job) => ({ ...job, status, stage: pairs.find((pair) => pairKey(pair.provider, pair.market) === pairKey(job.provider, job.market))?.stage || job.stage }));
}

function materializeJobs({
  providers,
  markets,
  marketAccess,
  hotel,
  bookingDetails,
  stage,
}: {
  providers: string[];
  markets: string[];
  marketAccess?: Record<string, string>;
  hotel: any;
  bookingDetails: any;
  stage: "initial" | "expanded" | "deferred";
}) {
  const jobs: any[] = [];
  for (const providerId of providers) {
    const adapter = getProviderAdapter(providerId);
    if (!adapter) continue;
    for (const marketCode of markets) {
      const market = getMarket(marketCode);
      const preferred =
        marketAccess?.[marketCode] ||
        market?.defaultAccessMethod ||
        "storefront";
      const access = resolveMarketAccess(marketCode, preferred);
      const jobId = `job_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
      const base = {
        id: jobId,
        provider: providerId,
        providerName: adapter.name,
        market: marketCode,
        stage,
        accessMethod: access.access_method,
        actualProxyCountry: access.enabled ? access.actual_proxy_country : null,
        storefrontRegion: access.storefront_region,
        accessVerified: false,
        tinyfishRunId: null,
        streamingUrl: null,
        sourceUrl: null,
        offer: null,
        raw: null,
      };

      if (!access.enabled) {
        jobs.push({
          ...base,
          status: JOB_STATUS.UNSUPPORTED,
          url: null,
          goal: null,
          error: access.reason,
          startedAt: null,
          finishedAt: new Date().toISOString(),
        });
        continue;
      }

      const plan = adapter.investigate({
        hotel,
        bookingDetails,
        marketContext: access,
      });

      if (plan.unsupported) {
        jobs.push({
          ...base,
          status: JOB_STATUS.UNSUPPORTED,
          actualProxyCountry: access.actual_proxy_country,
          url: null,
          goal: null,
          error: plan.reason,
          startedAt: null,
          finishedAt: new Date().toISOString(),
        });
        continue;
      }

      jobs.push({
        ...base,
        status: JOB_STATUS.QUEUED,
        actualProxyCountry: access.actual_proxy_country,
        url: plan.url,
        goal: plan.goal,
        outputSchema: plan.outputSchema,
        browserProfile: plan.browserProfile || "lite",
        requireProxy: Boolean(plan.requireProxy),
        sourceUrl: plan.url,
        error: null,
        startedAt: null,
        finishedAt: null,
      });
    }
  }
  return jobs;
}

export function kick(investigationId) {
  if (running.has(investigationId)) return;
  running.add(investigationId);
  processInvestigation(investigationId)
    .catch(async (error) => {
      await updateInvestigation(investigationId, (rec) => {
        rec.status = "failed";
        rec.events.push({
          id: `evt_${randomUUID().slice(0, 8)}`,
          type: "INVESTIGATION_FAILED",
          message: error instanceof Error ? error.message : "Runner failed",
          jobId: null,
          at: new Date().toISOString(),
        });
        return rec;
      });
    })
    .finally(() => {
      running.delete(investigationId);
    });
}

async function processInvestigation(investigationId) {
  const record = await loadInvestigation(investigationId);
  if (!record) return;

  await updateInvestigation(investigationId, (rec) => {
    rec.status = "running";
    return rec;
  });

  const deadlineAt = Date.parse(record.deadlineAt || "") || Date.parse(record.createdAt) + INVESTIGATION_DEADLINE_MS;
  const remaining = deadlineAt - Date.now();
  let deadlineTimer: ReturnType<typeof setTimeout> | null = null;
  if (remaining <= 0) {
    await enforceDeadline(investigationId);
    return;
  }
  deadlineTimer = setTimeout(() => {
    void enforceDeadline(investigationId);
  }, remaining);

  try {
    const runnable = record.jobs.filter(
      (job) => job.status === JOB_STATUS.QUEUED && job.stage !== "deferred",
    );
    await Promise.all(
      runnable.map((job) =>
        agentQueue.push(() => executeJob(investigationId, job.id)),
      ),
    );
    await finalizeInvestigation(investigationId);
  } finally {
    if (deadlineTimer) clearTimeout(deadlineTimer);
  }
}

async function enforceDeadline(investigationId) {
  const controllers = liveAborts.get(investigationId) || new Map();
  for (const [jobId, controller] of controllers) {
    const record = await loadInvestigation(investigationId);
    const job = record?.jobs?.find((item) => item.id === jobId);
    if (job?.stage === "expanded") continue;
    controller.abort();
  }
  await updateInvestigation(investigationId, (rec) => {
    const next = applyDeadline(rec.jobs);
    rec.jobs = next.jobs;
    rec.summary = summarize(rec.jobs);
    if (next.changed) {
      rec.events.push({
        id: `evt_${randomUUID().slice(0, 8)}`,
        type: "DEADLINE",
        message: "Initial comparison stopped at 2 minutes. Prices already found are kept.",
        jobId: null,
        at: new Date().toISOString(),
      });
    }
    return rec;
  });
  await finalizeInvestigation(investigationId);
}

async function finalizeInvestigation(investigationId) {
  const finalRec = await loadInvestigation(investigationId);
  if (!finalRec) return;
  if (!shouldFinalize(finalRec.jobs, finalRec.finalizedAt)) return;

  const offers = finalRec.jobs.map((j) => j.offer).filter(Boolean);
  const ranking = await rankOffers(
    offers,
    finalRec.request.preferredCurrency || "USD",
    { homeCountry: finalRec.request.homeCountry || null },
  );
  const nextStatus = deriveStatus(finalRec.jobs);

  for (const offer of offers) {
    try {
      await recordOfferObservation({
        offer,
        investigationId,
      });
    } catch {
      // Observation persistence must not block finalization.
    }
  }

  await updateInvestigation(investigationId, (rec) => {
    if (rec.finalizedAt || !shouldFinalize(rec.jobs, null)) return rec;
    rec.offers = ranking.offers;
    rec.ranking = {
      lowestComparableId: ranking.lowestComparable?.id || null,
      cheapestBookableId: ranking.cheapestBookable?.id || null,
      bestVerifiedOfferId: ranking.bestVerified?.id || null,
      lowestDisplayedId: ranking.lowestDisplayed?.id || null,
      decision: ranking.decision,
      roomDiffNotes: ranking.roomDiffNotes,
    };
    rec.summary = summarize(rec.jobs);
    rec.status = nextStatus;
    rec.finalizedAt = rec.finalizedAt || new Date().toISOString();
    rec.events.push({
      id: `evt_${randomUUID().slice(0, 8)}`,
      type: "INVESTIGATION_FINISHED",
      message: `Investigation ${nextStatus}`,
      jobId: null,
      at: new Date().toISOString(),
    });
    return rec;
  });
}

async function executeJob(investigationId, jobId) {
  const current = await loadInvestigation(investigationId);
  const job = current?.jobs?.find((j) => j.id === jobId);
  if (!job || job.status !== JOB_STATUS.QUEUED) return;
  const deadlineAt = Date.parse(current.deadlineAt || "") || Date.parse(current.createdAt) + INVESTIGATION_DEADLINE_MS;
  const remaining = job.stage === "expanded" ? JOB_TIMEOUT_MS : deadlineAt - Date.now();
  if (job.stage !== "expanded" && remaining <= 0) {
    await patchJob(investigationId, jobId, {
      status: JOB_STATUS.TIMED_OUT,
      finishedAt: new Date().toISOString(),
      error: "Not started. The 2-minute comparison deadline passed.",
    });
    return;
  }

  await patchJob(investigationId, jobId, {
    status: JOB_STATUS.STARTING,
    startedAt: new Date().toISOString(),
  });
  const jobStartedAt = Date.now();
  let firstProgressAt = 0;
  await pushEvent(investigationId, {
    type: "JOB_STARTED",
    message: `${job.providerName} × ${job.market} starting`,
    jobId,
  });
  logTiming("job_started", {
    investigationId,
    jobId,
    provider: job.provider,
    market: job.market,
  });
  const started = (await loadInvestigation(investigationId))?.jobs?.find((item) => item.id === jobId);
  if (!started || started.status !== JOB_STATUS.STARTING) return;

  const abort = new AbortController();
  let timedOut = false;
  const timers = liveAborts.get(investigationId) || new Map();
  timers.set(jobId, abort);
  liveAborts.set(investigationId, timers);
  // Abort stops this process from waiting. TinyFish may still finish the remote run.
  const timer = setTimeout(() => {
    timedOut = true;
    abort.abort();
  }, Math.max(1, Math.min(JOB_TIMEOUT_MS, remaining)));

  try {
    let completePayload: any = null;

    const stream = await streamInvestigationAgent(
      {
        url: job.url,
        goal: job.goal,
        outputSchema: job.outputSchema,
        browserProfile: job.browserProfile,
        proxyCountryCode: job.actualProxyCountry,
        requireProxy: job.requireProxy,
        signal: abort.signal,
      },
      {
        onStarted: async (event) => {
          await patchJob(investigationId, jobId, {
            status: JOB_STATUS.STARTING,
            tinyfishRunId: event.run_id || null,
          });
          await pushEvent(investigationId, {
            type: "STARTED",
            message: `Agent started (${event.run_id || "no run id"})`,
            jobId,
            payload: { run_id: event.run_id },
          });
        },
        onStreamingUrl: async (event) => {
          await patchJob(investigationId, jobId, {
            streamingUrl: event.streaming_url || null,
            browserSessionStatus: "streaming",
            extractionStatus: "pending",
          });
          await pushEvent(investigationId, {
            type: "STREAMING_URL",
            message: "Live browser preview available",
            jobId,
            payload: { streaming_url: event.streaming_url },
          });
        },
        onProgress: async (event) => {
          const next = mapTinyFishEventToStatus("PROGRESS", event.purpose);
          if (next) {
            await patchJob(investigationId, jobId, {
              status: next,
              extractionStatus: next === JOB_STATUS.EXTRACTING ? "extracting" : undefined,
            });
            if (!firstProgressAt) {
              firstProgressAt = Date.now();
              logTiming("first_progress", {
                investigationId,
                jobId,
                elapsedMs: firstProgressAt - jobStartedAt,
              });
            }
          }
          await pushEvent(investigationId, {
            type: "PROGRESS",
            message: event.purpose || "Agent progress",
            jobId,
            payload: { purpose: event.purpose },
          });
        },
        onComplete: async (event) => {
          completePayload = event;
        },
      },
    );

    for await (const event of stream) {
      if (event?.type === "COMPLETE") completePayload = event;
    }

    const latest = await loadInvestigation(investigationId);
    const latestJob = latest.jobs.find((j) => j.id === jobId);
    const request = latest.request;

    const outcome = resolveStreamOutcome(completePayload);
    if (!completePayload || outcome.status !== JOB_STATUS.COMPLETED) {
      await patchJob(investigationId, jobId, {
        status: outcome.status,
        browserSessionStatus: outcome.browserSessionStatus,
        extractionStatus: outcome.extractionStatus,
        finishedAt: new Date().toISOString(),
        error: outcome.error,
        tinyfishRunId:
          completePayload?.run_id || latestJob.tinyfishRunId || null,
        raw: completePayload || null,
      });
      await pushEvent(investigationId, {
        type: "COMPLETE",
        message: "Job failed",
        jobId,
      });
      return;
    }

    const normalizeStarted = Date.now();
    const offer = normalizeJobOffer({
      job: latestJob,
      hotel: request.hotel,
      bookingDetails: request.bookingDetails,
      runResult: completePayload?.result,
      tinyfishRunId: completePayload?.run_id || latestJob.tinyfishRunId,
      raw: completePayload?.result ?? null,
      homeCountry: request.homeCountry || null,
    });

    const confirmedUnavailable = explicitUnavailable(offer);
    const extractionOk =
      confirmedUnavailable ||
      (offer.propertyMatch !== "unmatched" &&
        (offer.totalPrice != null ||
          offer.basePrice != null ||
          offer.nightlyPrice != null ||
          offer.displayedUnscoped != null));

    await patchJob(investigationId, jobId, {
      status: extractionOk ? JOB_STATUS.COMPLETED : JOB_STATUS.FAILED,
      browserSessionStatus: "finished",
      extractionStatus: confirmedUnavailable
        ? "unavailable"
        : extractionOk
          ? "extracted"
          : offer.propertyMatch === "unmatched"
            ? "no_offer"
            : "invalid_output",
      finishedAt: new Date().toISOString(),
      tinyfishRunId: offer.tinyfishRunId,
      sourceUrl: offer.sourceUrl || latestJob.url,
      offer: extractionOk ? offer : null,
      error: extractionOk
        ? null
        : "Price retrieved incompletely or property could not be matched. No verified comparable offer was stored.",
      raw: completePayload?.result ?? null,
      accessVerified: latestJob.accessMethod === "proxy",
    });

    await pushEvent(investigationId, {
      type: "COMPLETE",
      message: confirmedUnavailable
        ? "Unavailable"
        : extractionOk
          ? "Structured findings returned"
          : "Completed without a verified offer",
      jobId,
    });
    logTiming(extractionOk ? "offer_extracted" : "job_finished_without_offer", {
      investigationId,
      jobId,
      provider: latestJob.provider,
      market: latestJob.market,
      normalizeMs: Date.now() - normalizeStarted,
      elapsedMs: Date.now() - jobStartedAt,
      priceBasis: offer.priceBasis,
      comparisonClass: offer.comparisonClass,
    });
  } catch (error) {
    await patchJob(investigationId, jobId, {
      status: timedOut ? JOB_STATUS.TIMED_OUT : JOB_STATUS.FAILED,
      browserSessionStatus: timedOut ? "expired" : "finished",
      extractionStatus: "failed",
      finishedAt: new Date().toISOString(),
      error: timedOut
        ? "This check timed out before a price was extracted."
        : error instanceof Error
          ? error.message
          : "Agent execution failed",
    });
    await pushEvent(investigationId, {
      type: "ERROR",
      message: error instanceof Error ? error.message : "Agent execution failed",
      jobId,
    });
  } finally {
    clearTimeout(timer);
    liveAborts.get(investigationId)?.delete(jobId);
  }
}

async function patchJob(investigationId, jobId, patch) {
  return updateInvestigation(investigationId, (rec) => {
    rec.jobs = rec.jobs.map((job) => {
      if (job.id !== jobId) return job;
      if (patch.status && !canReplaceJobStatus(job.status, patch.status)) return job;
      const next = { ...job };
      for (const [key, value] of Object.entries(patch)) {
        if (value !== undefined) next[key] = value;
      }
      return next;
    });
    rec.summary = summarize(rec.jobs);
    return rec;
  });
}

async function pushEvent(investigationId, event) {
  return updateInvestigation(investigationId, (rec) => {
    rec.events.push({
      id: `evt_${randomUUID().slice(0, 8)}`,
      at: new Date().toISOString(),
      ...event,
    });
    return rec;
  });
}

function summarize(jobs) {
  return {
    total: jobs.length,
    queued: jobs.filter((j) => j.status === JOB_STATUS.QUEUED).length,
    running: jobs.filter((j) =>
      [
        JOB_STATUS.STARTING,
        JOB_STATUS.NAVIGATING,
        JOB_STATUS.SEARCHING,
        JOB_STATUS.EXTRACTING,
        JOB_STATUS.VERIFYING,
      ].includes(j.status),
    ).length,
    completed: jobs.filter((j) => j.status === JOB_STATUS.COMPLETED).length,
    failed: jobs.filter((j) =>
      [JOB_STATUS.FAILED, JOB_STATUS.TIMED_OUT].includes(j.status),
    ).length,
    unsupported: jobs.filter((j) => j.status === JOB_STATUS.UNSUPPORTED)
      .length,
  };
}

function logTiming(event: string, fields: Record<string, unknown>) {
  console.info(
    JSON.stringify({
      source: "priceport",
      event,
      at: new Date().toISOString(),
      ...fields,
    }),
  );
}

function deriveStatus(jobs) {
  const active = jobs.some((j) =>
    [
      JOB_STATUS.QUEUED,
      JOB_STATUS.STARTING,
      JOB_STATUS.NAVIGATING,
      JOB_STATUS.SEARCHING,
      JOB_STATUS.EXTRACTING,
      JOB_STATUS.VERIFYING,
    ].includes(j.status),
  );
  if (active) return "running";
  const completed = jobs.filter((j) => j.status === JOB_STATUS.COMPLETED).length;
  const failed = jobs.filter((j) =>
    [JOB_STATUS.FAILED, JOB_STATUS.TIMED_OUT].includes(j.status),
  ).length;
  if (completed > 0 && failed > 0) return "partial";
  if (completed > 0) return "completed";
  return "failed";
}

export async function cancelInvestigation(id) {
  // Sync /run jobs cannot be cancelled per TinyFish docs.
  // We mark queued jobs cancelled; in-flight stream jobs continue until COMPLETE.
  return updateInvestigation(id, (rec) => {
    rec.jobs = rec.jobs.map((job) =>
      job.status === JOB_STATUS.QUEUED
        ? {
            ...job,
            status: JOB_STATUS.FAILED,
            error: "Cancelled before start",
            finishedAt: new Date().toISOString(),
          }
        : job,
    );
    rec.events.push({
      id: `evt_${randomUUID().slice(0, 8)}`,
      type: "CANCEL_REQUESTED",
      message:
        "Cancel requested. Queued jobs stopped. In-flight TinyFish stream runs cannot always be aborted mid-flight.",
      jobId: null,
      at: new Date().toISOString(),
    });
    rec.summary = summarize(rec.jobs);
    return rec;
  });
}
