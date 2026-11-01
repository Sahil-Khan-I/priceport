import { NextResponse } from "next/server";
import { discoverAlternativeHotels } from "@/lib/hotels/alternatives";
import { loadInvestigation } from "@/lib/storage/file-store";
import { isTinyFishConfigured } from "@/lib/tinyfish/config";

export async function POST(request: Request) {
  if (!isTinyFishConfigured()) {
    return NextResponse.json(
      {
        error: "TinyFish is not configured",
        alternatives: [],
      },
      { status: 503 },
    );
  }

  const body = await request.json().catch(() => ({}));
  let hotelName = body.hotelName;
  let location = body.location;
  let checkIn = body.checkIn;
  let checkOut = body.checkOut;

  if (body.investigationId) {
    const record = await loadInvestigation(body.investigationId);
    if (!record) {
      return NextResponse.json(
        { error: "Investigation not found" },
        { status: 404 },
      );
    }
    hotelName = hotelName || record.request.hotel?.name;
    location = location || record.request.hotel?.location;
    checkIn = checkIn || record.request.bookingDetails?.checkIn;
    checkOut = checkOut || record.request.bookingDetails?.checkOut;
  }

  if (!hotelName || typeof hotelName !== "string") {
    return NextResponse.json(
      { error: "hotelName or investigationId is required" },
      { status: 400 },
    );
  }

  const result = await discoverAlternativeHotels({
    hotelName,
    location,
    checkIn,
    checkOut,
    limit: Number(body.limit) || 5,
  });

  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}