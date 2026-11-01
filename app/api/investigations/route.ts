import { NextResponse } from "next/server";
import { validateInvestigationRequest } from "@/lib/validation/schemas";
import { createInvestigation } from "@/lib/investigations/runner";
import { isTinyFishConfigured } from "@/lib/tinyfish/config";

export async function POST(request) {
  if (!isTinyFishConfigured()) {
    return NextResponse.json(
      {
        error:
          "TinyFish is not configured. Add your server-side API key to enable live investigations.",
        configured: false,
      },
      { status: 503 },
    );
  }

  try {
    const body = await request.json();
    const parsed = validateInvestigationRequest(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.errors.join("; ") }, { status: 400 });
    }

    const record = await createInvestigation(parsed.value);
    return NextResponse.json({
      id: record.id,
      status: record.status,
      summary: record.summary,
      jobs: record.jobs.map(publicJob),
    });
  } catch (error: unknown) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code?: string }).code || "")
        : "";
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to create investigation",
        code: code || undefined,
      },
      { status: code === "TINYFISH_CONFIG" ? 503 : 500 },
    );
  }
}

function publicJob(job) {
  return {
    id: job.id,
    provider: job.provider,
    providerName: job.providerName,
    market: job.market,
    status: job.status,
    accessMethod: job.accessMethod,
    actualProxyCountry: job.actualProxyCountry,
    storefrontRegion: job.storefrontRegion,
    tinyfishRunId: job.tinyfishRunId,
    streamingUrl: job.streamingUrl,
    error: job.error,
  };
}
