import { assertProxyCountry, isTinyFishConfigured } from "@/lib/tinyfish/config";
import { streamInvestigationAgent } from "@/lib/tinyfish/agent";
import { normalizeAgentRun } from "@/lib/tinyfish/normalize";
import { getProviderAdapter } from "@/lib/providers/provider-registry";
import { createJob, updateJob, appendJobEvent } from "./job-manager";
import { eventFromTinyFishSse, createInvestigationEvent } from "./events";
import { JOB_STATUS, mapTinyFishEventToStatus } from "./status";

/**
 * Investigation orchestrator — creates provider × market jobs and
 * prepares TinyFish execution. Full multi-job SSE pipeline lands in Phase 02.
 */

type MarketInput =
  | string
  | {
      code?: string;
      proxyCountry?: string;
      accessMethod?: string;
      requireProxy?: boolean;
    };

export function planInvestigation({
  category = "hotels",
  query,
  checkIn,
  checkOut,
  guests = 2,
  providers = [],
  markets = [],
}: {
  category?: string;
  query?: string;
  checkIn?: string;
  checkOut?: string;
  guests?: number;
  providers?: string[];
  markets?: MarketInput[];
} = {}) {
  const jobs: any[] = [];

  for (const providerId of providers) {
    const adapter = getProviderAdapter(providerId);
    if (!adapter) continue;

    for (const market of markets) {
      const marketObj = typeof market === "string" ? { code: market } : market || {};
      const marketCode =
        typeof market === "string" ? market : marketObj.code || "";
      const proxyCheck = assertProxyCountry(
        marketObj.proxyCountry || marketCode,
      );
      const proxySupported = Boolean(proxyCheck?.supported);
      const accessMethod = proxySupported
        ? `TinyFish proxy ${proxyCheck.code}`
        : marketObj.accessMethod || "Regional storefront / unsupported proxy";

      if (marketObj.requireProxy && !proxySupported) {
        jobs.push(
          createJob({
            provider: adapter.name,
            marketContext: marketCode,
            url: null,
            goal: null,
            proxyCountry: null,
            accessMethod: "unsupported",
          }),
        );
        updateJob(jobs[jobs.length - 1].id, {
          status: JOB_STATUS.UNSUPPORTED,
          error: proxyCheck?.reason || "Unsupported market access method",
        });
        continue;
      }

      const request = adapter.buildSearchRequest({
        query,
        checkIn,
        checkOut,
        guests,
        marketCode,
      });

      jobs.push(
        createJob({
          provider: adapter.name,
          marketContext: marketCode,
          url: request.url,
          goal: request.goal,
          proxyCountry: proxySupported ? proxyCheck.code : undefined,
          accessMethod,
        }),
      );
    }
  }

  return {
    category,
    configured: isTinyFishConfigured(),
    jobs,
  };
}

/**
 * Execute a single planned job via TinyFish SSE.
 * Callers should only invoke this server-side when credentials exist.
 */
export async function executeJob(
  jobId: string,
  handlers: { onEvent?: (event: any) => void } = {},
) {
  if (!isTinyFishConfigured()) {
    throw new Error("TinyFish is not configured on the server.");
  }

  const { getJob } = await import("./job-manager");
  const job = getJob(jobId);
  if (!job) throw new Error(`Unknown job: ${jobId}`);
  if (job.status === JOB_STATUS.UNSUPPORTED) return job;
  if (!job.url || !job.goal) {
    return updateJob(jobId, {
      status: JOB_STATUS.FAILED,
      error: "Job missing url or goal",
      finishedAt: new Date().toISOString(),
    });
  }

  updateJob(jobId, {
    status: JOB_STATUS.STARTING,
    startedAt: new Date().toISOString(),
  });
  appendJobEvent(
    jobId,
    createInvestigationEvent({
      type: "QUEUED",
      message: "Investigation started",
      jobId,
    }),
  );

  let lastNormalized: any = null;

  const stream = await streamInvestigationAgent(
    {
      url: job.url,
      goal: job.goal,
      proxyCountryCode: job.proxyCountry,
      requireProxy: Boolean(job.proxyCountry),
    },
    {
      onStarted: (event) => {
        updateJob(jobId, {
          status: JOB_STATUS.STARTING,
          tinyfishRunId: event.run_id,
        });
        appendJobEvent(jobId, eventFromTinyFishSse(event, jobId));
        handlers.onEvent?.(event);
      },
      onStreamingUrl: (event) => {
        updateJob(jobId, { streamingUrl: event.streaming_url });
        appendJobEvent(jobId, eventFromTinyFishSse(event, jobId));
        handlers.onEvent?.(event);
      },
      onProgress: (event) => {
        const next = mapTinyFishEventToStatus("PROGRESS", event.purpose);
        if (next) updateJob(jobId, { status: next });
        appendJobEvent(jobId, eventFromTinyFishSse(event, jobId));
        handlers.onEvent?.(event);
      },
      onComplete: (event) => {
        lastNormalized = normalizeAgentRun(
          {
            run_id: event.run_id,
            status: event.status,
            result: event.result,
            finished_at: new Date().toISOString(),
          },
          {
            provider: job.provider,
            marketView: job.marketContext,
            actualProxyCountry: job.proxyCountry,
            url: job.url,
          },
        );
        updateJob(jobId, {
          status:
            String(event.status).toUpperCase() === "COMPLETED"
              ? JOB_STATUS.COMPLETED
              : JOB_STATUS.FAILED,
          extracted: lastNormalized,
          tinyfishRunId: event.run_id,
          finishedAt: new Date().toISOString(),
        });
        appendJobEvent(jobId, eventFromTinyFishSse(event, jobId));
        handlers.onEvent?.(event);
      },
    },
  );

  for await (const event of stream) {
    // Handlers already update state; iteration drains the stream.
    if (event?.type === "COMPLETE" && !lastNormalized) {
      lastNormalized = normalizeAgentRun(
        {
          run_id: event.run_id,
          status: event.status,
          result: event.result,
        },
        {
          provider: job.provider,
          marketView: job.marketContext,
          actualProxyCountry: job.proxyCountry,
          url: job.url,
        },
      );
    }
  }

  return getJob(jobId);
}
