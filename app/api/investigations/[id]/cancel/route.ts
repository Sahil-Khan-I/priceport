import { NextResponse } from "next/server";
import { cancelInvestigation } from "@/lib/investigations/runner";
import { loadInvestigation } from "@/lib/storage/file-store";

export async function POST(_request, context) {
  const { id } = await context.params;
  const existing = await loadInvestigation(id);
  if (!existing) {
    return NextResponse.json({ error: "Investigation not found" }, { status: 404 });
  }

  const updated = await cancelInvestigation(id);
  return NextResponse.json({
    id: updated.id,
    status: updated.status,
    summary: updated.summary,
  });
}
