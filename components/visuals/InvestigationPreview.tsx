import Badge from "@/components/ui/Badge";
import {
  INVESTIGATION_PREVIEW_EVENTS,
  INVESTIGATION_PREVIEW_JOBS,
} from "@/lib/constants";
import { formatStatusLabel } from "@/lib/utils";

const statusTone = {
  extracting: "accent",
  searching: "lavender",
  verifying: "warn",
  completed: "success",
  queued: "muted",
};

export default function InvestigationPreview() {
  return (
    <div className="overflow-hidden rounded-[28px] border border-white/10 bg-pp-dark shadow-[0_30px_80px_rgba(0,0,0,0.35)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4 sm:px-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-white/45">
            Investigation Room
          </p>
          <h3 className="mt-1 text-lg font-semibold text-white">
            Dubai hotel · 4 concurrent jobs
          </h3>
        </div>
        <Badge tone="dark">Product preview · not a live TinyFish run</Badge>
      </div>

      <div className="grid gap-5 p-5 lg:grid-cols-[1.15fr_0.85fr] lg:p-6">
        <div className="grid gap-3 sm:grid-cols-2">
          {INVESTIGATION_PREVIEW_JOBS.map((job) => (
            <article
              key={job.id}
              className="rounded-2xl border border-white/10 bg-pp-dark-card p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-white">{job.provider}</p>
                  <p className="mt-1 text-xs text-white/50">
                    × {job.market} · {job.accessMethod}
                  </p>
                </div>
                <Badge tone={statusTone[job.status] || "muted"}>
                  {formatStatusLabel(job.status)}
                </Badge>
              </div>

              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className={`h-full rounded-full bg-pp-accent ${
                    job.progress < 100 ? "pp-progress-bar" : ""
                  }`}
                  style={{ width: `${job.progress}%` }}
                />
              </div>

              <p className="mt-3 text-xs leading-relaxed text-white/60">
                {job.extracted}
              </p>
              <p className="mt-2 text-[11px] text-white/35">
                Proxy country: {job.proxyCountry || "null (not claimed)"}
              </p>
            </article>
          ))}
        </div>

        <div className="flex flex-col gap-4">
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-pp-accent/20 to-transparent" />
            <div className="pp-scan-line absolute inset-x-4 h-10 rounded-full bg-pp-accent/20 blur-md" />
            <p className="relative text-xs uppercase tracking-[0.14em] text-white/45">
              Browser preview pane
            </p>
            <p className="relative mt-3 text-sm text-white/70">
              When live, TinyFish SSE can provide a streaming browser URL for
              embedding. This panel is a visual stand-in.
            </p>
            <div className="relative mt-4 grid grid-cols-3 gap-2">
              {["Search", "Results", "Fees"].map((label) => (
                <div
                  key={label}
                  className="rounded-lg border border-white/10 bg-white/5 px-2 py-3 text-center text-[11px] text-white/55"
                >
                  {label}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-pp-dark-card p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-white/45">
              Activity feed
            </p>
            <ul className="mt-3 space-y-2.5">
              {INVESTIGATION_PREVIEW_EVENTS.map((event) => (
                <li
                  key={`${event.time}-${event.text}`}
                  className="flex gap-3 text-sm text-white/70"
                >
                  <span className="w-10 shrink-0 font-mono text-[11px] text-white/35">
                    {event.time}
                  </span>
                  <span>{event.text}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
