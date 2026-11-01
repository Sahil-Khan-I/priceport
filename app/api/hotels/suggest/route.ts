import { NextResponse } from "next/server";
import { discoverHotels } from "@/lib/hotels/discover";
import { toTinyFishError } from "@/lib/tinyfish/errors";

/**
 * Lightweight hotel suggestions for autocomplete.
 * Uses TinyFish Search only — never launches browser agents.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = String(searchParams.get("q") || "").trim();
  const destination = String(searchParams.get("destination") || "").trim();
  const location = String(searchParams.get("location") || "US").trim();
  const limit = Number(searchParams.get("limit") || 6);

  if (query.length < 3) {
    return NextResponse.json({
      configured: true,
      results: [],
      error: null,
      hint: "Type at least 3 characters",
    });
  }

  try {
    const result = await discoverHotels({
      query,
      destination: destination || null,
      location,
      limit: Math.min(Math.max(limit, 1), 8),
    });
    return NextResponse.json(result);
  } catch (error) {
    const tf = toTinyFishError(error);
    return NextResponse.json(
      { error: tf.message, code: tf.code, results: [] },
      { status: 500 },
    );
  }
}
