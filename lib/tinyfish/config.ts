/**
 * TinyFish configuration grounded in official docs.
 * Docs: https://docs.tinyfish.ai/
 * Proxies: https://docs.tinyfish.ai/key-concepts/proxies
 */

export const TINYFISH_ENDPOINTS = {
  agentRun: "https://agent.tinyfish.ai/v1/automation/run",
  agentRunAsync: "https://agent.tinyfish.ai/v1/automation/run-async",
  agentRunSse: "https://agent.tinyfish.ai/v1/automation/run-sse",
  search: "https://api.search.tinyfish.ai",
  fetch: "https://api.fetch.tinyfish.ai",
  browser: "https://api.browser.tinyfish.ai",
} as const;

/** Documented proxy country codes only — do not invent others. */
export const SUPPORTED_PROXY_COUNTRIES = [
  "US",
  "GB",
  "CA",
  "DE",
  "FR",
  "JP",
  "AU",
] as const;

export const BROWSER_PROFILES = {
  LITE: "lite",
  STEALTH: "stealth",
} as const;

export const AGENT_EVENT_TYPES = [
  "STARTED",
  "STREAMING_URL",
  "PROGRESS",
  "HEARTBEAT",
  "COMPLETE",
] as const;

export const DEFAULT_AGENT_TIMEOUT_MS = 120_000;
export const DEFAULT_SEARCH_TIMEOUT_MS = 10_000;
export const DEFAULT_FETCH_TIMEOUT_MS = 150_000;

export function getTinyFishApiKey(): string | null {
  return process.env.TINYFISH_API_KEY || null;
}

export function isTinyFishConfigured(): boolean {
  return Boolean(getTinyFishApiKey());
}

export function assertProxyCountry(countryCode?: string | null) {
  if (!countryCode) {
    return {
      supported: false,
      code: "",
      reason: "No country code provided",
    };
  }
  const code = String(countryCode).toUpperCase();
  if (!(SUPPORTED_PROXY_COUNTRIES as readonly string[]).includes(code)) {
    return {
      supported: false,
      code,
      reason: `TinyFish proxy does not document support for ${code}. Supported: ${SUPPORTED_PROXY_COUNTRIES.join(", ")}.`,
    };
  }
  return { supported: true, code, reason: null as string | null };
}
