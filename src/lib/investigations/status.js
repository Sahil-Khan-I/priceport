export const JOB_STATUS = {
  QUEUED: "queued",
  STARTING: "starting",
  NAVIGATING: "navigating",
  SEARCHING: "searching",
  EXTRACTING: "extracting",
  VERIFYING: "verifying",
  COMPLETED: "completed",
  FAILED: "failed",
  TIMED_OUT: "timed_out",
  UNSUPPORTED: "unsupported",
};

export const STATUS_LABELS = {
  queued: "Queued",
  starting: "Starting",
  navigating: "Navigating",
  searching: "Searching",
  extracting: "Extracting",
  verifying: "Verifying",
  completed: "Completed",
  failed: "Failed",
  timed_out: "Timed out",
  unsupported: "Unsupported",
};

export function isTerminalStatus(status) {
  return ["completed", "failed", "timed_out", "unsupported"].includes(status);
}

export function mapTinyFishEventToStatus(eventType, purpose = "") {
  const type = String(eventType || "").toUpperCase();
  if (type === "STARTED") return JOB_STATUS.STARTING;
  if (type === "COMPLETE") return JOB_STATUS.COMPLETED;
  if (type === "PROGRESS") {
    const text = String(purpose || "").toLowerCase();
    if (text.includes("extract")) return JOB_STATUS.EXTRACTING;
    if (text.includes("search") || text.includes("filter")) {
      return JOB_STATUS.SEARCHING;
    }
    if (text.includes("visit") || text.includes("navig") || text.includes("open")) {
      return JOB_STATUS.NAVIGATING;
    }
    if (text.includes("verif") || text.includes("check")) {
      return JOB_STATUS.VERIFYING;
    }
    return JOB_STATUS.NAVIGATING;
  }
  return null;
}
