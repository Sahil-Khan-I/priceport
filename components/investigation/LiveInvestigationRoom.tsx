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
  investigationStages,
  summarizeProgress,
  type LiveEvent,
  type LiveJob,
} from "@/lib/investigations/live-view";
import { describeRoomPreferences } from "@/lib/search/room-preferences";

type InvestigationPayload = {
  id: string;
  status: string;
  createdAt?: string;
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
  const [selectedPreviewJobId, setSelectedPreviewJobId] = useState<string | null>(null);
  const [showAllEvents, setShowAllEvents] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [expandBusy, setExpandBusy] = useState(false);
  const [now, setNow] = useState<number | null>(null);

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
  const stages = useMemo(() => investigationStages(jobs), [jobs]);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);
  const elapsedLabel = useMemo(() => {
    const started = Date.parse(data?.createdAt || "");
    if (!now || !Number.isFinite(started)) return null;
    const seconds = Math.max(0, Math.round((now - started) / 1000));
    const minutes = Math.floor(seconds / 60);
    return minutes ? `${minutes}m ${seconds % 60}s` : `${seconds}s`;
  }, [data?.createdAt, now]);
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
  const previewJobs = jobs.filter((job) => Boolean(job.streamingUrl));
  const previewJob =
    previewJobs.find((job) => job.id === selectedPreviewJobId) || previewJobs[0] || null;
  const previewUrl = previewJob?.streamingUrl || null;
  const sessionLive = Boolean(
    previewJob &&
      !["completed", "failed", "timed_out", "unsupported", "cancelled"].includes(
        String(previewJob.status),
      ),
  );
  const running = !isTerminalInvestigation(data?.status);
  const failedCount = jobs.filter((job) =>
    ["failed", "timed_out"].includes(String(job.status)),
  ).length;
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
      <Container className="py-7 sm:py-10">
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
            <h1 className="mt-2 max-w-3xl text-3xl font-semibold tracking-tight text-pp-text sm:text-[2.6rem]">
              {data.request?.hotel?.name || "Hotel investigation"}
            </h1>
            <p className="mt-2 text-sm text-pp-muted">
              {[
                data.request?.hotel?.location,
                stay?.checkIn && stay?.checkOut
                  ? `${stay.checkIn} – ${stay.checkOut}`
                  : null,
                stay?.adults != null ? `${stay.adults} adults` : null,
                stay?.rooms != null ? `${stay.rooms} room${stay.rooms === 1 ? "" : "s"}` : null,
                describeRoomPreferences(data.request?.roomPreferences || stay?.roomPreferences),
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

        <section className="mt-7 rounded-2xl border border-pp-border bg-white p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-pp-text">
                {progress.researching
                  ? `${progress.researching} provider${progress.researching === 1 ? "" : "s"} still investigating`
                  : running
                    ? "Researching your stay"
                    : "Research finished"}
              </h2>
              <p className="mt-1 max-w-xl text-sm text-pp-muted">
                {progress.terminal} of {progress.total} checks finished
                {progress.offers ? ` · ${progress.offers} offers found` : ""}
                {progress.comparable ? ` · ${progress.comparable} with a matched property` : ""}
              </p>
            </div>
            <p className="text-sm text-pp-text">
              {progress.terminal} of {progress.total} checks finished
            </p>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-pp-accent transition-[width] duration-500"
              style={{ width: `${Math.round(progress.fraction * 100)}%` }}
            />
          </div>
          <p className="mt-3 text-sm text-pp-text">
            {progress.terminal} of {progress.total} markets checked · {progress.offers} offers found ·{" "}
            {progress.verified} verified
            {progress.researching ? ` · ${progress.researching} still checking` : ""}
            {elapsedLabel ? ` · ${elapsedLabel}` : ""}
          </p>
          <ol className="mt-4 grid gap-2 sm:grid-cols-2">
            {stages.map((stage) => (
              <li key={stage.id} className="flex items-center gap-2 text-sm text-pp-text">
                <span
                  className={`h-2 w-2 rounded-full ${stage.complete ? "bg-emerald-500" : "bg-slate-300"}`}
                  aria-hidden
                />
                {stage.label}
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Metric label="Providers" value={progress.providers} />
          <Metric label="Markets" value={progress.markets} />
          <Metric label="Offers found" value={progress.offers} />
          <Metric label="Need attention" value={progress.attention} />
        </section>

        <section className="mt-8">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-pp-accent">Live price feed</p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-pp-text">Price findings</h2>
            </div>
            <p className="text-xs text-pp-muted">Offers appear as providers respond</p>
          </div>
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
          <section className="mt-8 overflow-hidden rounded-2xl border border-slate-800 bg-[#111827] shadow-[0_18px_50px_rgba(15,23,42,0.16)]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-5">
              <div className="flex items-center gap-3">
                  <span className={`relative flex h-2.5 w-2.5 ${sessionLive ? "" : "opacity-40"}`}>
                  <span className={`absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-50 ${sessionLive ? "animate-ping" : ""}`} />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-white">
                    {sessionLive ? "Live browser session" : "Session finished"}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    {previewJob
                      ? `${previewJob.providerName || previewJob.provider} · ${previewJob.market} · ${accessLabel(previewJob)}`
                      : "Waiting for a real TinyFish streaming URL"}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {previewJobs.length > 1 ? previewJobs.map((job) => (
                  <button
                    key={job.id}
                    type="button"
                    onClick={() => setSelectedPreviewJobId(job.id)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${previewJob?.id === job.id ? "bg-white text-slate-900" : "bg-white/10 text-slate-300 hover:bg-white/15"}`}
                  >
                    {job.providerName || job.provider} · {job.market}
                  </button>
                )) : null}
                <button
                  type="button"
                  onClick={() => setWatchLive((value) => !value)}
                  className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-white/10"
                >
                  {watchLive ? "Minimize" : "Expand"}
                </button>
              </div>
            </div>
            <div className="bg-[#0b1220] p-2 sm:p-3">
              {watchLive && sessionLive ? (
                <iframe
                  title={`TinyFish live browser — ${previewJob?.providerName || "provider"}`}
                  src={previewUrl}
                  allow="clipboard-read; clipboard-write"
                  className="h-[min(72vh,760px)] w-full rounded-lg border border-white/10 bg-white"
                />
              ) : (
                <div className="flex min-h-44 flex-col items-center justify-center rounded-lg border border-white/10 bg-[radial-gradient(ellipse_at_center,_rgba(59,130,246,0.16),_transparent_65%)] px-5 py-8 text-center">
                  <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-lg text-blue-300">↗</div>
                  <p className="text-sm font-medium text-white">
                    {sessionLive
                      ? `${previewJob?.providerName || "Booking provider"} is open in the research browser`
                      : "The live view has ended"}
                  </p>
                  <p className="mt-1 max-w-md text-xs text-slate-400">
                    {sessionLive
                      ? "The live session is available while the agent is working."
                      : previewJob?.status === "timed_out"
                        ? "This check timed out. A finished browser is not a verified price."
                        : "The browser session ended. Pricing is shown only from the extracted result."}
                  </p>
                  {sessionLive ? (
                  <button
                    type="button"
                    onClick={() => setWatchLive(true)}
                    className="mt-4 rounded-lg bg-white px-4 py-2 text-xs font-semibold text-slate-900 transition hover:bg-slate-100"
                  >
                    Watch live session
                  </button>
                  ) : null}
                </div>
              )}
            </div>
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
