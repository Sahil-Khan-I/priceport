"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Container from "@/components/ui/Container";
import Button from "@/components/ui/Button";
import {
  accessLabel,
  collapseActivity,
  dedupeEvents,
  derivePriceInsights,
  describeEvent,
  groupJobsByProvider,
  isTerminalInvestigation,
  mergeJobs,
  summarizeProgress,
  type LiveEvent,
  type LiveJob,
} from "@/lib/investigations/live-view";

type InvestigationPayload = {
  id: string;
  status: string;
  updatedAt?: string;
  request?: any;
  summary?: any;
  jobs?: LiveJob[];
  events?: LiveEvent[];
};

export default function LiveInvestigationRoom({
  investigationId,
}: {
  investigationId: string;
}) {
  const [data, setData] = useState<InvestigationPayload | null>(null);
  const [error, setError] = useState("");
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [actionBusy, setActionBusy] = useState("");
  const [openProvider, setOpenProvider] = useState<string | null>(null);
  const [watchLive, setWatchLive] = useState(false);
  const [showAllEvents, setShowAllEvents] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [expandBusy, setExpandBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let poll: ReturnType<typeof setInterval> | null = null;

    function applySnapshot(json: InvestigationPayload) {
      setData((prev) => {
        if (
          prev?.updatedAt &&
          json.updatedAt &&
          json.updatedAt < prev.updatedAt &&
          !isTerminalInvestigation(json.status)
        ) {
          return {
            ...prev,
            jobs: mergeJobs(prev.jobs || [], json.jobs || []),
          };
        }
        return {
          ...json,
          jobs: mergeJobs(prev?.jobs || [], json.jobs || []),
        };
      });
      setEvents((prev) => dedupeEvents([...(json.events || []), ...prev]));
    }

    async function load() {
      try {
        const response = await fetch(`/api/investigations/${investigationId}`);
        const json = await response.json();
        if (!response.ok) throw new Error(json.error || "Failed to load");
        if (!cancelled) applySnapshot(json);
        if (!cancelled && isTerminalInvestigation(json.status) && poll) {
          clearInterval(poll);
          poll = null;
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
                updatedAt: payload.updatedAt || new Date().toISOString(),
                jobs: mergeJobs(prev.jobs || [], payload.jobs || prev.jobs || []),
              }
            : prev,
        );
        if (isTerminalInvestigation(payload.status)) {
          source.close();
          if (poll) clearInterval(poll);
        }
      } catch {
        // ignore malformed
      }
    });

    source.addEventListener("event", (evt) => {
      try {
        const payload = JSON.parse(evt.data);
        setEvents((prev) => dedupeEvents([...prev, payload]));
      } catch {
        // ignore
      }
    });

    source.addEventListener("done", () => {
      load();
      source.close();
    });

    source.onerror = () => {
      source.close();
    };

    poll = setInterval(load, 4000);
    return () => {
      cancelled = true;
      if (poll) clearInterval(poll);
      source.close();
    };
  }, [investigationId]);

  const jobs = useMemo(() => data?.jobs || [], [data?.jobs]);
  const progress = useMemo(() => summarizeProgress(jobs), [jobs]);
  const groups = useMemo(() => groupJobsByProvider(jobs), [jobs]);
  const findings = useMemo(
    () => jobs.filter((job) => job.offer?.totalPrice != null),
    [jobs],
  );
  const insights = useMemo(() => derivePriceInsights(jobs), [jobs]);
  const timeline = useMemo(() => {
    const lines = dedupeEvents(events)
      .map((event) => ({
        id: event.id,
        at: event.at,
        text: describeEvent(event, jobs),
      }))
      .filter((row) => row.text);
    return collapseActivity(lines).reverse();
  }, [events, jobs]);
  const previewUrl = jobs.find((job) => job.streamingUrl)?.streamingUrl || null;
  const running = !isTerminalInvestigation(data?.status);
  const failedCount = jobs.filter((job) => job.status === "failed").length;
  const expanded = jobs.some((job) => (job as { stage?: string }).stage === "expanded");
  const stay = data?.request?.bookingDetails;
  const providers = [
    ...new Set(jobs.map((job) => job.providerName || job.provider).filter(Boolean)),
  ];
  const markets = [...new Set(jobs.map((job) => job.market).filter(Boolean))];

  async function cancelInvestigation() {
    setActionBusy("cancel");
    try {
      const response = await fetch(
        `/api/investigations/${investigationId}/cancel`,
        { method: "POST" },
      );
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Cancel failed");
      setData((prev) =>
        prev ? { ...prev, status: json.status, summary: json.summary } : prev,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cancel failed");
    } finally {
      setActionBusy("");
    }
  }

  async function expandComparison() {
    setExpandBusy(true);
    try {
      const response = await fetch(
        `/api/investigations/${investigationId}/expand`,
        { method: "POST" },
      );
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Could not expand");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not expand");
    } finally {
      setExpandBusy(false);
    }
  }

  async function retryFailed() {
    setActionBusy("retry");
    try {
      const response = await fetch(
        `/api/investigations/${investigationId}/retry`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
      );
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Retry failed");
      setData((prev) =>
        prev ? { ...prev, status: json.status, summary: json.summary } : prev,
      );
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
    <div className="bg-pp-bg">
      <Container className="py-8 sm:py-12">
        <header className="flex flex-col gap-6 border-b border-pp-border pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-pp-muted">
              Live intelligence
              {running ? (
                <span className="ml-2 inline-flex items-center gap-1.5 normal-case tracking-normal text-pp-accent">
                  <span className="h-1.5 w-1.5 rounded-full bg-pp-accent" />
                  Researching
                </span>
              ) : null}
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-pp-text">
              {data.request?.hotel?.name || "Hotel investigation"}
            </h1>
            <p className="mt-2 text-sm text-pp-muted">
              {[
                data.request?.hotel?.location,
                stay?.checkIn && stay?.checkOut
                  ? `${stay.checkIn} – ${stay.checkOut}`
                  : null,
                stay?.adults != null ? `${stay.adults} adults` : null,
                stay?.rooms != null ? `${stay.rooms} room` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            <p className="mt-2 text-sm text-pp-text">
              Comparing {providers.length || "selected"} providers across{" "}
              {markets.length || "selected"} market perspectives.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {running ? (
              <Button
                variant="secondary"
                onClick={cancelInvestigation}
                disabled={actionBusy === "cancel"}
              >
                {actionBusy === "cancel" ? "Cancelling…" : "Cancel"}
              </Button>
            ) : null}
            <Button
              variant="secondary"
              onClick={expandComparison}
              disabled={expandBusy || expanded}
            >
              {expanded ? "Comparison expanded" : expandBusy ? "Expanding…" : "Expand comparison"}
            </Button>
            {failedCount > 0 ? (
              <Button
                variant="secondary"
                onClick={retryFailed}
                disabled={actionBusy === "retry"}
              >
                {actionBusy === "retry" ? "Retrying…" : "Retry failed"}
              </Button>
            ) : null}
            {!running ? (
              <Button href={`/results/${data.id}`}>View results</Button>
            ) : null}
            <Button href="/search" variant="secondary">
              New search
            </Button>
          </div>
        </header>

        <section className="mt-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-pp-text">
                {running ? "Researching your stay" : "Research finished"}
              </h2>
              <p className="mt-1 max-w-xl text-sm text-pp-muted">
                Priceport is checking the selected booking providers and comparing
                their available offers.
              </p>
            </div>
            <p className="text-sm text-pp-text">
              {progress.terminal} of {progress.total} investigations finished
            </p>
          </div>
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-pp-bg-secondary">
            <div
              className="h-full bg-pp-accent transition-[width] duration-500"
              style={{ width: `${Math.round(progress.fraction * 100)}%` }}
            />
          </div>
          <p className="mt-3 text-sm text-pp-muted">
            {progress.completed} completed · {progress.researching} researching ·{" "}
            {progress.waiting} waiting
            {progress.attention
              ? ` · ${progress.attention} need attention`
              : ""}
          </p>
        </section>

        <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Metric label="Providers" value={progress.providers} />
          <Metric label="Markets" value={progress.markets} />
          <Metric label="Offers found" value={progress.offers} />
          <Metric label="Need attention" value={progress.attention} />
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-semibold text-pp-text">Price findings</h2>
          <p className="mt-1 text-sm text-pp-muted">
            Offers discovered so far. Final comparisons appear as evidence is
            verified.
          </p>
          {insights.length ? (
            <ul className="mt-4 space-y-2">
              {insights.map((insight) => (
                <li
                  key={insight}
                  className="rounded-xl border border-pp-border bg-pp-white px-4 py-3 text-sm text-pp-text"
                >
                  {insight}
                </li>
              ))}
            </ul>
          ) : null}
          {findings.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-pp-border bg-pp-white px-5 py-8">
              <p className="text-sm font-medium text-pp-text">Checking live prices</p>
              <p className="mt-1 text-sm text-pp-muted">
                Your first offers will appear here as providers respond.
              </p>
              <ul className="mt-3 space-y-1 text-sm text-pp-muted">
                {jobs
                  .filter((job) =>
                    ["queued", "starting", "running", "navigating", "searching", "extracting"].includes(
                      String(job.status),
                    ),
                  )
                  .slice(0, 4)
                  .map((job) => (
                    <li key={job.id}>
                      {job.providerName} · {job.market}
                    </li>
                  ))}
              </ul>
            </div>
          ) : (
            <ul className="mt-4 space-y-3">
              {findings.map((job) => (
                <li
                  key={job.id}
                  className="rounded-2xl border border-pp-border bg-pp-white px-5 py-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-pp-text">
                        {job.providerName} · {job.market}
                      </p>
                      <p className="mt-1 text-xs text-pp-muted">{accessLabel(job)}</p>
                      <p className="mt-2 text-xs text-pp-muted">
                        {[job.offer?.roomType, job.offer?.mealPlan]
                          .filter(Boolean)
                          .join(" · ") || "Room details still unknown"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-semibold tracking-tight text-pp-text">
                        {job.offer?.currency} {job.offer?.totalPrice}
                      </p>
                      <p className="mt-1 text-xs text-pp-muted">
                        {job.offer?.totalStatus || "Displayed price — total not fully confirmed"} ·{" "}
                        {job.offer?.verificationStatus || "Provisional until comparison finishes"}
                      </p>
                      {job.sourceUrl ? (
                        <a
                          href={job.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 inline-block text-sm text-pp-accent hover:underline"
                        >
                          Open source
                        </a>
                      ) : null}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-semibold text-pp-text">Providers</h2>
          <div className="mt-3 divide-y divide-pp-border rounded-2xl border border-pp-border bg-pp-white">
            {groups.map((group) => {
              const open = openProvider === group.provider;
              return (
                <div key={group.provider}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left"
                    onClick={() =>
                      setOpenProvider(open ? null : group.provider)
                    }
                    aria-expanded={open}
                  >
                    <span>
                      <span className="block text-sm font-medium text-pp-text">
                        {group.provider}
                      </span>
                      <span className="mt-1 block text-xs text-pp-muted">
                        {group.markets} markets · {group.completed} finished ·{" "}
                        {group.offers} offers
                      </span>
                    </span>
                    <span className="text-xs text-pp-muted">{open ? "Hide" : "Details"}</span>
                  </button>
                  {open ? (
                    <ul className="space-y-2 px-4 pb-4">
                      {group.jobs.map((job) => (
                        <li
                          key={job.id}
                          className="rounded-xl bg-pp-bg px-3 py-3 text-sm"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-medium text-pp-text">
                              {job.market} · {accessLabel(job)}
                            </span>
                            <span className="text-xs text-pp-muted">{job.status}</span>
                          </div>
                          {job.offer?.totalPrice != null ? (
                            <p className="mt-1 text-pp-text">
                              {job.offer.currency} {job.offer.totalPrice}
                            </p>
                          ) : null}
                          {job.error ? (
                            <p className="mt-1 text-xs text-pp-coral">{job.error}</p>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>

        {previewUrl ? (
          <section className="mt-8">
            {!watchLive ? (
              <Button variant="secondary" onClick={() => setWatchLive(true)}>
                Watch live browser
              </Button>
            ) : (
              <div className="rounded-2xl border border-pp-border bg-pp-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-pp-text">Live browser</p>
                  <button
                    type="button"
                    className="text-sm text-pp-accent"
                    onClick={() => setWatchLive(false)}
                  >
                    Close
                  </button>
                </div>
                <iframe
                  title="TinyFish live browser"
                  src={previewUrl}
                  className="mt-3 aspect-video w-full rounded-xl border border-pp-border bg-pp-bg"
                />
              </div>
            )}
          </section>
        ) : null}

        <section className="mt-10">
          <h2 className="text-lg font-semibold text-pp-text">Activity</h2>
          <ul className="mt-3 space-y-2">
            {(showAllEvents ? timeline : timeline.slice(0, 5)).map((row) => (
              <li key={row.id} className="text-sm text-pp-muted">
                <span className="text-pp-text">{row.text}</span>
              </li>
            ))}
            {timeline.length === 0 ? (
              <li className="text-sm text-pp-muted">Waiting for the first update.</li>
            ) : null}
          </ul>
          {timeline.length > 5 ? (
            <button
              type="button"
              className="mt-3 text-sm text-pp-accent"
              onClick={() => setShowAllEvents((value) => !value)}
            >
              {showAllEvents ? "Show less" : "View more"}
            </button>
          ) : null}
        </section>

        <section className="mt-8 border-t border-pp-border pt-4">
          <button
            type="button"
            className="text-sm text-pp-muted hover:text-pp-text"
            onClick={() => setShowDiagnostics((value) => !value)}
          >
            {showDiagnostics ? "Hide diagnostics" : "Diagnostics"}
          </button>
          {showDiagnostics ? (
            <div className="mt-3 space-y-2 text-xs text-pp-muted">
              <p>Investigation {data.id}</p>
              <p>Status {data.status}</p>
              {jobs
                .filter((job) => job.tinyfishRunId)
                .map((job) => (
                  <p key={job.id}>
                    {job.providerName} · {job.market}: {job.tinyfishRunId}
                  </p>
                ))}
            </div>
          ) : null}
        </section>

        {error ? <p className="mt-4 text-sm text-pp-coral">{error}</p> : null}

        <p className="mt-8 text-sm text-pp-muted">
          <Link href="/search" className="text-pp-accent hover:underline">
            Start another search
          </Link>
        </p>
      </Container>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-pp-border bg-pp-white px-4 py-3">
      <p className="text-[11px] uppercase tracking-[0.12em] text-pp-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-pp-text">{value}</p>
    </div>
  );
}
