export function createInvestigationEvent({
  type,
  message,
  jobId = null,
  tinyfishRunId = null,
  payload = null,
}: {
  type: string;
  message: string;
  jobId?: string | null;
  tinyfishRunId?: string | null;
  payload?: unknown;
}) {
  return {
    id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type,
    message,
    jobId,
    tinyfishRunId,
    payload,
    at: new Date().toISOString(),
  };
}

export function eventFromTinyFishSse(event: any, jobId: string | null) {
  const type = event?.type || "PROGRESS";
  let message = type;

  if (type === "STARTED") message = "Agent started";
  if (type === "STREAMING_URL") message = "Live browser preview available";
  if (type === "PROGRESS") message = event.purpose || "Agent progress";
  if (type === "HEARTBEAT") message = "Heartbeat";
  if (type === "COMPLETE") {
    message = `Investigation ${event.status || "finished"}`;
  }

  return createInvestigationEvent({
    type,
    message,
    jobId,
    tinyfishRunId: event?.run_id || null,
    payload: event,
  });
}
