"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Container from "@/components/ui/Container";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { formatMoney } from "@/lib/pricing/currency";

export default function TrackDetailView({ trackId }: { trackId: string }) {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch(`/api/tracks/${trackId}`);
        const json = await response.json();
        if (!response.ok) throw new Error(json.error || "Failed to load track");
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed");
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [trackId]);

  async function recheck() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/tracks/${trackId}/check`, {
        method: "POST",
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Re-check failed");
      router.push(`/investigate/${json.investigationId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Re-check failed");
      setBusy(false);
    }
  }

  if (error && !data) {
    return (
      <Container className="py-16">
        <p className="text-pp-coral">{error}</p>
      </Container>
    );
  }

  if (!data) {
    return (
      <Container className="py-16">
        <p className="text-pp-muted">Loading track…</p>
      </Container>
    );
  }

  const track = data.track;

  return (
    <Container className="py-12 sm:py-16">
      <Badge tone="accent">Tracked search</Badge>
      <h1 className="mt-3 text-3xl font-semibold text-pp-text">{track.label}</h1>
      <p className="mt-2 text-sm text-pp-muted">
        {track.bookingDetails?.checkIn} → {track.bookingDetails?.checkOut} ·{" "}
        {track.providers?.join(", ")} × {track.markets?.join(", ")}
      </p>
      <p className="mt-3 max-w-2xl text-sm text-pp-muted">{data.monitoringNote}</p>

      <div className="mt-6 flex flex-wrap gap-2">
        <Button onClick={recheck} disabled={busy}>
          {busy ? "Launching…" : "Re-check now (manual)"}
        </Button>
        {track.lastInvestigationId ? (
          <Button
            href={`/results/${track.lastInvestigationId}`}
            variant="secondary"
          >
            Latest results
          </Button>
        ) : null}
      </div>

      {error ? <p className="mt-4 text-sm text-pp-coral">{error}</p> : null}

      <div className="mt-10 space-y-4">
        {(data.series || []).length === 0 ? (
          <p className="text-sm text-pp-muted">
            No observations yet. Observations appear after real investigations complete.
          </p>
        ) : (
          data.series.map((series: any) => (
            <article
              key={series.key}
              className="rounded-[20px] border border-pp-border bg-pp-white p-5"
            >
              <p className="text-sm font-medium text-pp-text">
                {series.latest?.provider} · {series.latest?.market} ·{" "}
                {series.latest?.roomType || "room unknown"}
              </p>
              <p className="mt-2 text-sm text-pp-muted">
                Latest:{" "}
                {series.latest?.displayedTotal != null
                  ? formatMoney(
                      series.latest.displayedTotal,
                      series.latest.currency || "USD",
                    )
                  : "—"}{" "}
                · {series.observations.length} observation
                {series.observations.length === 1 ? "" : "s"}
              </p>
              <p className="mt-2 text-sm text-pp-muted">
                {series.movement?.available
                  ? series.movement.note
                  : series.movement?.reason || "No movement yet"}
              </p>
            </article>
          ))
        )}
      </div>

      <p className="mt-8 text-sm text-pp-muted">
        <Link href="/tracks" className="text-pp-accent hover:underline">
          All tracks
        </Link>
      </p>
    </Container>
  );
}
