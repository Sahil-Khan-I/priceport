import { NextResponse } from "next/server";
import { isTinyFishConfigured } from "@/lib/tinyfish/config";
import { runInvestigationAgent } from "@/lib/tinyfish/agent";
import { toTinyFishError } from "@/lib/tinyfish/errors";

/**
 * Thin TinyAgent endpoint for server-side investigations.
 * Phase 02 will expand into job-based Investigation Room streaming.
 * Note: `runtime` / `maxDuration` segment configs conflict with cacheComponents
 * in this Next.js setup, so they are omitted.
 */
export async function POST(request) {
  if (!isTinyFishConfigured()) {
    return NextResponse.json(
      {
        error:
          "TinyFish is not configured. Set TINYFISH_API_KEY on the server.",
        configured: false,
      },
      { status: 503 },
    );
  }

  try {
    const body = await request.json();
    const url = body.url?.trim();
    const goal = body.goal?.trim();
    const proxyCountryCode = body.proxyCountryCode || null;

    if (!url || !goal) {
      return NextResponse.json(
        { error: "Both url and goal are required" },
        { status: 400 },
      );
    }

    const result = await runInvestigationAgent({
      url,
      goal,
      proxyCountryCode,
      browserProfile: body.browserProfile || "lite",
      outputSchema: body.outputSchema,
      requireProxy: Boolean(body.requireProxy),
    });

    return NextResponse.json(result);
  } catch (error) {
    const tfError = toTinyFishError(error);
    return NextResponse.json(
      {
        error: tfError.message,
        code: tfError.code,
        details: tfError.details,
      },
      { status: tfError.code === "UNSUPPORTED_MARKET" ? 422 : 500 },
    );
  }
}
