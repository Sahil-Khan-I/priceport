"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Container from "@/components/ui/Container";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import InvestigationStatus from "@/components/investigation/InvestigationStatus";
import BrowserPreview from "@/components/investigation/BrowserPreview";
import { formatStatusLabel } from "@/lib/utils";

type InvestigationPayload = {
  id: string;
  status: string;
  request?: any;
  summary?: any;
  jobs?: any[];
  events?: any[];
};

export default function LiveInvestigationRoom({
  investigationId,
}: {
  investigationId: string;
}) {
  const [data, setData] = useState<InvestigationPayload | null>(null);
  const [error, setError] = useState("");
  const [events, setEvents] = useState<any[]>([]);
  const [actionBusy, setActionBusy] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch(`/api/investigations/${investigationId}`);
        const json = await response.json();
        if (!response.ok) throw new Error(json.error || "Failed to load");
        if (!cancelled) {
          setData(json);
          setEvents(json.events || []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load");
        }
      }
    }

    load();

    const source = new EventSource(
      `/api/investigations/${investigationId}/events`,
    );

    source.addEventListener("status", (evt) => {
      try {
        const payload = JSON.parse(evt.data);
        setData((prev) =>
          prev
            ? {
                ...prev,
                status: payload.status,
                summary: payload.summary,
                jobs: (prev.jobs || []).map((job: any) => {
                  const patch = payload.jobs?.find((j: any) => j.id === job.id);
                  return patch ? { ...job, ...patch } : job;
                }),
              }
            : prev,
        );
      } catch {
        // ignore malformed
      }
    });

    source.addEventListener("event", (evt) => {
      try {
        const payload = JSON.parse(evt.data);
        setEvents((prev) => {
          if (prev.some((e) => e.id === payload.id)) return prev;
          return [...prev, payload];
        });
      } catch {
        // ignore
      }
    });

    source.addEventListener("done", () => {
      load();
      source.close();
    });

    source.onerror = () => {
      // Fall back to polling
      source.close();
    };

    const poll = setInterval(load, 4000);
    return () => {
      cancelled = true;
      clearInterval(poll);
      source.close();
    };
  }, [investigationId]);

  const previewUrl = useMemo(() => {
    return data?.jobs?.find((j) => j.streamingUrl)?.streamingUrl || null;
  }, [data]);

  const done = ["completed", "failed", "partial"].includes(data?.status || "");

  async function cancelInvestigation() {
    setActionBusy("cancel");
    try {
      const response = await fetch(`/api/investigations/${investigationId}/cancel`, {
        method: "POST",
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Cancel failed");
      setData((prev) => (prev ? { ...prev, status: json.status, summary: json.summary } : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cancel failed");
    } finally {
      setActionBusy("");
    }
  }

  async function retryFailed() {
    setActionBusy("retry");
    try {
      const response = await fetch(`/api/investigations/${investigationId}/retry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Retry failed");
      setData((prev) => (prev ? { ...prev, status: json.status, summary: json.summary } : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Retry failed");
    } finally {
      setActionBusy("");
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
        <p className="text-pp-muted">Loading investigation…</p>
      </Container>
    );
  }

  return (
    <div className="bg-pp-dark py-12 sm:py-16">
      <Container>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-white/45">
              Investigation Room
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-white">
              {data.request?.hotel?.name}
            </h1>
            <p className="mt-2 text-sm text-white/60">
              {data.request?.bookingDetails?.checkIn} →{" "}
              {data.request?.bookingDetails?.checkOut} ·{" "}
              {data.request?.bookingDetails?.adults} adults ·{" "}
              {data.request?.bookingDetails?.rooms} room(s)
            </p>
            <p className="mt-2 font-mono text-xs text-white/35">
              {data.id} · status {data.status}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone="dark">
              {data.summary?.completed || 0}/{data.summary?.total || 0} completed
            </Badge>
            {!done ? (
              <Button
                variant="dark"
                onClick={cancelInvestigation}
                disabled={actionBusy === "cancel"}
              >
                {actionBusy === "cancel" ? "Cancelling…" : "Cancel queued"}
              </Button>
            ) : null}
            {(data.summary?.failed || 0) > 0 ? (
              <Button
                variant="dark"
                onClick={retryFailed}
                disabled={actionBusy === "retry"}
              >
                {actionBusy === "retry" ? "Retrying…" : "Retry failed"}
              </Button>
            ) : null}
            {done ? (
              <Button href={`/results/${data.id}`} variant="dark">
                View results
              </Button>
            ) : null}
          </div>
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="grid gap-3 sm:grid-cols-2">
            {(data.jobs || []).map((job: any) => (
              <article
                key={job.id}
                className="rounded-2xl border border-white/10 bg-pp-dark-card p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-white">
                      {job.providerName}
                    </p>
                    <p className="mt-1 text-xs text-white/50">
                      × {job.market} ·{" "}
                      {String(job.accessMethod || "")
                        .toLowerCase()
                        .includes("proxy") || job.actualProxyCountry
                        ? `Proxy${job.actualProxyCountry ? ` · ${job.actualProxyCountry}` : ""}`
                        : String(job.accessMethod || "")
                              .toLowerCase()
                              .includes("storefront")
                          ? "Storefront"
                          : job.accessMethod || "Access unknown"}
                    </p>
                  </div>
                  <InvestigationStatus status={job.status} />
                </div>
                {job.tinyfishRunId ? (
                  <p className="mt-3 font-mono text-[11px] text-white/35">
                    run {job.tinyfishRunId}
                  </p>
                ) : null}
                {job.error ? (
                  <p className="mt-3 text-xs text-pp-coral">{job.error}</p>
                ) : null}
                {job.offer?.totalPrice != null ? (
                  <p className="mt-3 text-sm text-white">
                    {job.offer.currency} {job.offer.totalPrice}
                    <span className="ml-2 text-xs text-white/45">
                      match {job.offer.propertyMatch} · verify{" "}
                      {job.offer.verificationStatus || "—"}
                    </span>
                  </p>
                ) : null}
                {job.offer?.roomType ? (
                  <p className="mt-2 text-xs text-white/45">
                    Room {job.offer.roomType}
                    {job.offer.mealPlan ? ` · ${job.offer.mealPlan}` : ""}
                  </p>
                ) : null}
                {job.sourceUrl ? (
                  <a
                    href={job.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-block text-xs text-pp-accent hover:underline"
                  >
                    Source URL
                  </a>
                ) : null}
              </article>
            ))}
          </div>

          <div className="space-y-4">
            <BrowserPreview
              streamingUrl={previewUrl}
              label={
                previewUrl
                  ? "Live TinyFish browser preview"
                  : "Browser preview (appears when TinyFish sends STREAMING_URL)"
              }
            />
            <div className="rounded-2xl border border-white/10 bg-pp-dark-card p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-white/45">
                Activity feed
              </p>
              <ul className="mt-3 max-h-80 space-y-2.5 overflow-y-auto">
                {events.length === 0 ? (
                  <li className="text-sm text-white/50">Waiting for events…</li>
                ) : (
                  events
                    .slice()
                    .reverse()
                    .map((event) => (
                      <li
                        key={event.id}
                        className="flex gap-3 text-sm text-white/70"
                      >
                        <span className="w-16 shrink-0 font-mono text-[11px] text-white/35">
                          {new Date(event.at).toLocaleTimeString()}
                        </span>
                        <span>
                          <span className="text-white/40">
                            {formatStatusLabel(event.type)}
                          </span>
                          {" · "}
                          {event.message}
                        </span>
                      </li>
                    ))
                )}
              </ul>
            </div>
          </div>
        </div>

        <p className="mt-8 text-sm text-white/40">
          Events shown here come from persisted TinyFish job updates. Progress
          text is only displayed when TinyFish emits it.
        </p>
        <p className="mt-2 text-sm text-white/40">
          <Link href="/search" className="text-pp-accent hover:underline">
            Start another search
          </Link>
        </p>
      </Container>
    </div>
  );
}
