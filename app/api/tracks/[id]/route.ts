import { NextResponse } from "next/server";
import { getTrackIntelligence } from "@/lib/storage/observations-store";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const intel = await getTrackIntelligence(id);
  if (!intel) {
    return NextResponse.json({ error: "Track not found" }, { status: 404 });
  }
  return NextResponse.json(intel);
}
