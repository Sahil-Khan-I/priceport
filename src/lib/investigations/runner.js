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
import { JOB_STATUS, mapTinyFishEventToStatus } from "./status";

const running = new Set();

export async function createInvestigation(input) {
  if (!isTinyFishConfigured()) {
    const err = new Error(
      "TinyFish is not configured. Add your server-side API key to enable live investigations.",
    );
    err.code = "TINYFISH_CONFIG";
    throw err;
  }

  const id = `inv_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
  const jobs = [];

  for (const providerId of input.providers) {
    const adapter = getProviderAdapter(providerId);
    if (!adapter) continue;

    for (const marketCode of input.markets) {
      const preferred =
        input.marketAccess?.[marketCode] ||
        (["IN", "AE"].includes(marketCode) ? "storefront" : "proxy");
      const access = resolveMarketAccess(marketCode, preferred);
      const jobId = `job_${randomUUID().replace(/-/g, "").slice(0, 12)}`;

      if (!access.enabled) {
        jobs.push({
          id: jobId,
          provider: providerId,
          providerName: adapter.name,
          market: marketCode,
          status: JOB_STATUS.UNSUPPORTED,
          accessMethod: access.access_method,
          actualProxyCountry: null,
          storefrontRegion: access.storefront_region,
          accessVerified: false,
          url: null,
          goal: null,
          tinyfishRunId: null,
          streamingUrl: null,
          sourceUrl: null,
          error: access.reason,
          startedAt: null,
          finishedAt: new Date().toISOString(),
          offer: null,
          raw: null,
        });
        continue;
      }

      const plan = adapter.investigate({
        hotel: input.hotel,
        bookingDetails: input.bookingDetails,
        marketContext: access,
      });

      if (plan.unsupported) {
        jobs.push({
          id: jobId,
          provider: providerId,
          providerName: adapter.name,
          market: marketCode,
          status: JOB_STATUS.UNSUPPORTED,
          accessMethod: access.access_method,
          actualProxyCountry: access.actual_proxy_country,
          storefrontRegion: access.storefront_region,
          accessVerified: false,
          url: null,
          goal: null,
          tinyfishRunId: null,
          streamingUrl: null,
          sourceUrl: null,
          error: plan.reason,
          startedAt: null,
          finishedAt: new Date().toISOString(),
          offer: null,
          raw: null,
        });
        continue;
      }

      jobs.push({
        id: jobId,
        provider: providerId,
        providerName: adapter.name,
        market: marketCode,
        status: JOB_STATUS.QUEUED,
        accessMethod: access.access_method,
        actualProxyCountry: access.actual_proxy_country,
        storefrontRegion: access.storefront_region,
        accessVerified: false,
        url: plan.url,
        goal: plan.goal,
        outputSchema: plan.outputSchema,
        browserProfile: plan.browserProfile || "lite",
        requireProxy: Boolean(plan.requireProxy),
        tinyfishRunId: null,
        streamingUrl: null,
        sourceUrl: plan.url,
        error: null,
        startedAt: null,
        finishedAt: null,
        offer: null,
        raw: null,
      });
    }
  }

  const record = {
    id,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: "queued",
    request: input,
    jobs,
    events: [
      {
        id: `evt_${randomUUID().slice(0, 8)}`,
        type: "INVESTIGATION_CREATED",
        message: `Created ${jobs.length} investigation job(s)`,
        jobId: null,
        at: new Date().toISOString(),
      },
    ],
    offers: [],
    ranking: null,
    summary: summarize(jobs),
  };

  await saveInvestigation(record);
  kick(id);
  return record;
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

  const runnable = record.jobs.filter((j) => j.status === JOB_STATUS.QUEUED);

  await Promise.all(
    runnable.map((job) =>
      agentQueue.push(() => executeJob(investigationId, job.id)),
    ),
  );

  await finalizeInvestigation(investigationId);
}

async function finalizeInvestigation(investigationId) {
  const finalRec = await loadInvestigation(investigationId);
  if (!finalRec) return;

  const stillActive = finalRec.jobs.some((j) =>
    [
      JOB_STATUS.QUEUED,
      JOB_STATUS.STARTING,
      JOB_STATUS.NAVIGATING,
      JOB_STATUS.SEARCHING,
      JOB_STATUS.EXTRACTING,
      JOB_STATUS.VERIFYING,
    ].includes(j.status),
  );
  if (stillActive) return;

  const offers = finalRec.jobs.map((j) => j.offer).filter(Boolean);
  const ranking = await rankOffers(
    offers,
    finalRec.request.preferredCurrency || "USD",
  );
  const nextStatus = deriveStatus(finalRec.jobs);

  await updateInvestigation(investigationId, (rec) => {
    if (["completed", "failed", "partial"].includes(rec.status)) {
      // Already finalized by another worker pass.
      return rec;
    }
    rec.offers = ranking.offers;
    rec.ranking = {
      lowestComparableId: ranking.lowestComparable?.id || null,
      cheapestBookableId: ranking.cheapestBookable?.id || null,
      roomDiffNotes: ranking.roomDiffNotes,
    };
    rec.summary = summarize(rec.jobs);
    rec.status = nextStatus;
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

  await patchJob(investigationId, jobId, {
    status: JOB_STATUS.STARTING,
    startedAt: new Date().toISOString(),
  });
  await pushEvent(investigationId, {
    type: "JOB_STARTED",
    message: `${job.providerName} × ${job.market} starting`,
    jobId,
  });

  try {
    let completePayload = null;

    const stream = await streamInvestigationAgent(
      {
        url: job.url,
        goal: job.goal,
        outputSchema: job.outputSchema,
        browserProfile: job.browserProfile,
        proxyCountryCode: job.actualProxyCountry,
        requireProxy: job.requireProxy,
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
          if (next) await patchJob(investigationId, jobId, { status: next });
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

    const status = String(completePayload?.status || "").toUpperCase();
    if (status !== "COMPLETED") {
      await patchJob(investigationId, jobId, {
        status: JOB_STATUS.FAILED,
        finishedAt: new Date().toISOString(),
        error:
          completePayload?.error?.message ||
          "Investigation failed. No verified price was returned.",
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

    const offer = normalizeJobOffer({
      job: latestJob,
      hotel: request.hotel,
      bookingDetails: request.bookingDetails,
      runResult: completePayload?.result,
      tinyfishRunId: completePayload?.run_id || latestJob.tinyfishRunId,
      raw: completePayload?.result ?? null,
    });

    const extractionOk =
      offer.propertyMatch !== "unmatched" &&
      (offer.totalPrice != null ||
        offer.basePrice != null ||
        offer.availability === "unavailable");

    await patchJob(investigationId, jobId, {
      status: extractionOk ? JOB_STATUS.COMPLETED : JOB_STATUS.FAILED,
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
      message: extractionOk
        ? "Structured findings returned"
        : "Completed without a verified offer",
      jobId,
    });
  } catch (error) {
    await patchJob(investigationId, jobId, {
      status: JOB_STATUS.FAILED,
      finishedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Agent execution failed",
    });
    await pushEvent(investigationId, {
      type: "ERROR",
      message: error instanceof Error ? error.message : "Agent execution failed",
      jobId,
    });
  }
}

async function patchJob(investigationId, jobId, patch) {
  return updateInvestigation(investigationId, (rec) => {
    rec.jobs = rec.jobs.map((job) =>
      job.id === jobId ? { ...job, ...patch } : job,
    );
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
    failed: jobs.filter((j) => j.status === JOB_STATUS.FAILED).length,
    unsupported: jobs.filter((j) => j.status === JOB_STATUS.UNSUPPORTED)
      .length,
  };
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
  const failed = jobs.filter((j) => j.status === JOB_STATUS.FAILED).length;
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
