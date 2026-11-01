"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Container from "@/components/ui/Container";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";

export default function TracksView() {
  const [tracks, setTracks] = useState<any[]>([]);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch("/api/tracks");
        const json = await response.json();
        if (!response.ok) throw new Error(json.error || "Failed to load tracks");
        if (!cancelled) {
          setTracks(json.tracks || []);
          setNote(json.monitoringNote || "");
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load");
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Container className="py-12 sm:py-16">
      <Badge tone="accent">Price monitoring</Badge>
      <h1 className="mt-3 text-3xl font-semibold text-pp-text">Tracked searches</h1>
      <p className="mt-2 max-w-2xl text-sm text-pp-muted">
        {note ||
          "Monitoring currently requires a manual re-check. Background scheduling is not configured."}
      </p>

      {error ? <p className="mt-6 text-pp-coral">{error}</p> : null}

      <div className="mt-8 space-y-3">
        {tracks.length === 0 ? (
          <p className="text-sm text-pp-muted">
            No tracked searches yet. Finish an investigation and choose{" "}
            <span className="text-pp-text">Track this search</span> on the results page.
          </p>
        ) : (
          tracks.map((track) => (
            <article
              key={track.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-pp-border bg-pp-white px-5 py-4"
            >
              <div>
                <p className="font-medium text-pp-text">{track.label}</p>
                <p className="mt-1 text-sm text-pp-muted">
                  {track.bookingDetails?.checkIn} → {track.bookingDetails?.checkOut} ·{" "}
                  {track.markets?.join(", ")} · mode {track.monitoringMode}
                </p>
              </div>
              <Button href={`/tracks/${track.id}`} variant="secondary">
                Open
              </Button>
            </article>
          ))
        )}
      </div>

      <p className="mt-8 text-sm text-pp-muted">
        <Link href="/search" className="text-pp-accent hover:underline">
          New investigation
        </Link>
      </p>
    </Container>
  );
}
