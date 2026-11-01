import { NextResponse } from "next/server";
import { listProviders } from "@/lib/providers/provider-registry";

export async function GET() {
  return NextResponse.json({ providers: listProviders() });
}
