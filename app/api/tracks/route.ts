import { NextResponse } from "next/server";
import { loadInvestigation } from "@/lib/storage/file-store";
import {
  createTrackFromInvestigation,
  listTracks,
} from "@/lib/storage/observations-store";

export async function GET() {
  const tracks = await listTracks();
  return NextResponse.json({
    tracks,
    monitoringNote:
      "Price monitoring currently requires a manual re-check. Background scheduling and email alerts are not configured.",
  });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const investigationId = body.investigationId;
  if (!investigationId || typeof investigationId !== "string") {
    return NextResponse.json(
      { error: "investigationId is required" },
      { status: 400 },
    );
  }

  const record = await loadInvestigation(investigationId);
  if (!record) {
    return NextResponse.json(
      { error: "Investigation not found" },
      { status: 404 },
    );
  }

  const existing = (await listTracks()).find(
    (t) =>
      t.investigationId === investigationId ||
      t.lastInvestigationId === investigationId,
  );
  if (existing) {
    return NextResponse.json({ track: existing, created: false });
  }

  const track = await createTrackFromInvestigation(record);
  return NextResponse.json({ track, created: true });
}
