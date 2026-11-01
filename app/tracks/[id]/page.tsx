import { Suspense } from "react";
import TrackDetailView from "@/components/tracks/TrackDetailView";

export const instant = false;

export const metadata = {
  title: "Tracked search — Priceport",
  description: "Manual price monitoring for a saved hotel search.",
};

export default async function TrackDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense fallback={<div className="p-10 text-pp-muted">Loading track…</div>}>
      <TrackDetailView trackId={id} />
    </Suspense>
  );
}
