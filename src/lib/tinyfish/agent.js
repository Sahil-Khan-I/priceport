import { getTinyFishClient } from "./client";
import { assertProxyCountry, BROWSER_PROFILES } from "./config";
import { TinyFishUnsupportedMarketError, toTinyFishError } from "./errors";
import { normalizeAgentRun } from "./normalize";

/**
 * TinyAgent — primary investigation engine.
 * Uses documented SDK methods: client.agent.run / stream / queue.
 */

export async function runInvestigationAgent({
  url,
  goal,
  outputSchema,
  browserProfile = BROWSER_PROFILES.LITE,
  proxyCountryCode = null,
  requireProxy = false,
  signal,
}) {
  try {
    const proxy = buildProxyConfig(proxyCountryCode, requireProxy);
    const client = getTinyFishClient();

    const run = await client.agent.run(
      {
        url,
        goal,
        ...(outputSchema ? { output_schema: outputSchema } : {}),
        browser_profile: browserProfile,
        ...(proxy ? { proxy_config: proxy } : {}),
      },
      signal ? { signal } : undefined,
    );

    return {
      ok: run?.status === "COMPLETED" || run?.status === "completed",
      run,
      normalized: normalizeAgentRun(run, {
        url,
        actualProxyCountry: proxy?.country_code || null,
      }),
      streamingUrl: null,
    };
  } catch (error) {
    throw toTinyFishError(error);
  }
}

/**
 * Stream an investigation for Investigation Room live updates.
 * Yields TinyFish SSE events: STARTED, STREAMING_URL, PROGRESS, HEARTBEAT, COMPLETE.
 */
export async function streamInvestigationAgent(options, handlers = {}) {
  const {
    url,
    goal,
    outputSchema,
    browserProfile = BROWSER_PROFILES.LITE,
    proxyCountryCode = null,
    requireProxy = false,
    signal,
  } = options;

  const proxy = buildProxyConfig(proxyCountryCode, requireProxy);
  const client = getTinyFishClient();

  const stream = await client.agent.stream(
    {
      url,
      goal,
      ...(outputSchema ? { output_schema: outputSchema } : {}),
      browser_profile: browserProfile,
      ...(proxy ? { proxy_config: proxy } : {}),
    },
    {
      ...(signal ? { signal } : {}),
      onStarted: handlers.onStarted,
      onStreamingUrl: handlers.onStreamingUrl,
      onProgress: handlers.onProgress,
      onComplete: handlers.onComplete,
    },
  );

  return stream;
}

export async function queueInvestigationAgent(options) {
  const {
    url,
    goal,
    outputSchema,
    browserProfile = BROWSER_PROFILES.LITE,
    proxyCountryCode = null,
    requireProxy = false,
  } = options;

  const proxy = buildProxyConfig(proxyCountryCode, requireProxy);
  const client = getTinyFishClient();

  return client.agent.queue({
    url,
    goal,
    ...(outputSchema ? { output_schema: outputSchema } : {}),
    browser_profile: browserProfile,
    ...(proxy ? { proxy_config: proxy } : {}),
  });
}

function buildProxyConfig(proxyCountryCode, requireProxy) {
  if (!proxyCountryCode) {
    if (requireProxy) {
      throw new TinyFishUnsupportedMarketError(
        "Proxy country required but none provided.",
      );
    }
    return null;
  }

  const check = assertProxyCountry(proxyCountryCode);
  if (!check.supported) {
    if (requireProxy) {
      throw new TinyFishUnsupportedMarketError(check.reason, check);
    }
    return null;
  }

  // SDK proxyConfigSchema is strict: only `enabled` + optional `country_code`.
  return {
    enabled: true,
    country_code: check.code,
  };
}
