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
  const destinationCity = String(searchParams.get("city") || "").trim();
  const destinationCountry = String(searchParams.get("country") || "").trim();
  const destinationCountryCode = String(
    searchParams.get("countryCode") || "",
  ).trim();
  const limit = Number(searchParams.get("limit") || 6);
  const browse = searchParams.get("browse") === "1";

  if (!browse && query.length < 3) {
    return NextResponse.json({
      configured: true,
      results: [],
      error: null,
      hint: "Type at least 3 characters",
    });
  }

  try {
    const result = await discoverHotels({
      query: browse ? query || destinationCity || "hotels" : query,
      destination: destination || null,
      destinationCity: destinationCity || null,
      destinationCountry: destinationCountry || null,
      destinationCountryCode: destinationCountryCode || null,
      // Never use traveler home country here — destination drives location.
      limit: Math.min(Math.max(limit, 1), 8),
      browse,
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
