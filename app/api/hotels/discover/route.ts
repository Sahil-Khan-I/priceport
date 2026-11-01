import { NextResponse } from "next/server";
import { validateDiscoverRequest } from "@/lib/validation/schemas";
import { discoverHotels } from "@/lib/hotels/discover";
import { toTinyFishError } from "@/lib/tinyfish/errors";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = validateDiscoverRequest(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.errors.join("; ") }, { status: 400 });
    }

    const result = await discoverHotels({
      query: parsed.value.query,
      directUrl: parsed.value.directUrl,
      location: parsed.value.location,
      destination: parsed.value.destination,
      destinationCity: parsed.value.destinationCity,
      destinationCountry: parsed.value.destinationCountry,
      destinationCountryCode: parsed.value.destinationCountryCode,
      limit: parsed.value.limit,
    });
    return NextResponse.json(result);
  } catch (error) {
    const tf = toTinyFishError(error);
    return NextResponse.json(
      { error: tf.message, code: tf.code },
      { status: 500 },
    );
  }
}
