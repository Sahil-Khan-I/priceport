import { JOB_STATUS } from "./status";

/**
 * In-memory job manager for Phase 01 architecture.
 * Phase 02 should persist jobs (e.g. Supabase) and run a background worker.
 */

const jobs = new Map();

export function createJob({
  provider,
  marketContext,
  url,
  goal,
  proxyCountry = null,
  accessMethod = "unknown",
}) {
  const id = `job_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const job = {
    id,
    provider,
    marketContext,
    proxyCountry,
    accessMethod,
    url,
    goal,
    status: JOB_STATUS.QUEUED,
    startedAt: null,
    finishedAt: null,
    sourceUrl: url || null,
    extracted: null,
    error: null,
    tinyfishRunId: null,
    streamingUrl: null,
    usage: null,
    events: [],
  };
  jobs.set(id, job);
  return structuredClone(job);
}

export function getJob(id) {
  const job = jobs.get(id);
  return job ? structuredClone(job) : null;
}

export function listJobs() {
  return Array.from(jobs.values()).map((job) => structuredClone(job));
}

export function updateJob(id, patch) {
  const job = jobs.get(id);
  if (!job) return null;
  Object.assign(job, patch, { updatedAt: new Date().toISOString() });
  jobs.set(id, job);
  return structuredClone(job);
}

export function appendJobEvent(id, event) {
  const job = jobs.get(id);
  if (!job) return null;
  job.events = [...(job.events || []), event];
  jobs.set(id, job);
  return structuredClone(job);
}
