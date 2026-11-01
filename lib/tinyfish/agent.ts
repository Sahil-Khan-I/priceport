import { getTinyFishClient } from "./client";
import { assertProxyCountry, BROWSER_PROFILES } from "./config";
import { TinyFishUnsupportedMarketError, toTinyFishError } from "./errors";
import { normalizeAgentRun } from "./normalize";

type AgentOptions = {
  url: string;
  goal: string;
  outputSchema?: unknown;
  browserProfile?: string;
  proxyCountryCode?: string | null;
  requireProxy?: boolean;
  signal?: AbortSignal;
};

type StreamHandlers = {
  onStarted?: (event: any) => void | Promise<void>;
  onStreamingUrl?: (event: any) => void | Promise<void>;
  onProgress?: (event: any) => void | Promise<void>;
  onComplete?: (event: any) => void | Promise<void>;
};

export async function runInvestigationAgent({
  url,
  goal,
  outputSchema,
  browserProfile = BROWSER_PROFILES.LITE,
  proxyCountryCode = null,
  requireProxy = false,
  signal,
}: AgentOptions) {
  try {
    const proxy = buildProxyConfig(proxyCountryCode, requireProxy);
    const client = getTinyFishClient();

    const run = await client.agent.run(
      {
        url,
        goal,
        ...(outputSchema ? { output_schema: outputSchema as object } : {}),
        browser_profile: browserProfile as "lite" | "stealth",
        ...(proxy ? { proxy_config: proxy } : {}),
      } as any,
      signal ? { signal } : undefined,
    );

    return {
      ok: run?.status === "COMPLETED" || String(run?.status).toLowerCase() === "completed",
      run,
      normalized: normalizeAgentRun(run, {
        url,
        actualProxyCountry: proxy?.country_code || null,
      }),
      streamingUrl: null as string | null,
    };
  } catch (error) {
    throw toTinyFishError(error);
  }
}

export async function streamInvestigationAgent(
  options: AgentOptions,
  handlers: StreamHandlers = {},
) {
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
      ...(outputSchema ? { output_schema: outputSchema as object } : {}),
      browser_profile: browserProfile as "lite" | "stealth",
      ...(proxy ? { proxy_config: proxy } : {}),
    } as any,
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

export async function queueInvestigationAgent(options: AgentOptions) {
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
    ...(outputSchema ? { output_schema: outputSchema as object } : {}),
    browser_profile: browserProfile as "lite" | "stealth",
    ...(proxy ? { proxy_config: proxy } : {}),
  } as any);
}

function buildProxyConfig(
  proxyCountryCode: string | null | undefined,
  requireProxy: boolean,
) {
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
      throw new TinyFishUnsupportedMarketError(check.reason || "Unsupported", check);
    }
    return null;
  }

  return {
    enabled: true,
    country_code: check.code,
  };
}
