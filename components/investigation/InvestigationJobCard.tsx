import InvestigationStatus from "@/components/investigation/InvestigationStatus";

export default function InvestigationJobCard({ job }) {
  return (
    <article className="rounded-2xl border border-white/10 bg-pp-dark-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-white">{job.provider}</p>
          <p className="mt-1 text-xs text-white/50">
            × {job.market} · {job.accessMethod}
          </p>
        </div>
        <InvestigationStatus status={job.status} />
      </div>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-pp-accent"
          style={{ width: `${job.progress || 0}%` }}
        />
      </div>
      <p className="mt-3 text-xs text-white/60">{job.extracted}</p>
    </article>
  );
}
