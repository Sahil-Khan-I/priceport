import { NextResponse } from "next/server";
import { expandInvestigation } from "@/lib/investigations/runner";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    const { record, added } = await expandInvestigation(id);
    return NextResponse.json({
      id: record?.id || id,
      status: record?.status,
      stage: record?.stage,
      added,
      summary: record?.summary,
    });
  } catch (error) {
    const status =
      error && typeof error === "object" && "status" in error
        ? Number((error as { status?: number }).status) || 500
        : 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not expand" },
      { status },
    );
  }
}
