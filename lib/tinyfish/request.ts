/** Supported TinyFish agent fields only. No beta agent_config or max_steps. */

export function buildAgentRequest({
  url,
  goal,
  outputSchema,
  browserProfile = "lite",
  proxy = null,
}: {
  url: string;
  goal: string;
  outputSchema?: unknown;
  browserProfile?: string;
  proxy?: { enabled: boolean; country_code: string } | null;
}) {
  return {
    url,
    goal,
    ...(outputSchema ? { output_schema: outputSchema } : {}),
    browser_profile: browserProfile,
    ...(proxy ? { proxy_config: proxy } : {}),
  };
}

export function isConfigurationRejection(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  return /not enabled for custom max steps|beta program|agent_config|max_steps|maxSteps/i.test(message);
}
