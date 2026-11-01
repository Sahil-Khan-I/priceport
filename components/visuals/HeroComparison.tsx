import Badge from "@/components/ui/Badge";

const rows = [
  {
    provider: "Booking.com",
    market: "DE",
    price: "$478",
    note: "Proxy DE",
    tone: "default",
  },
  {
    provider: "Agoda",
    market: "GB",
    price: "$491",
    note: "Proxy GB",
    tone: "default",
  },
  {
    provider: "Booking.com",
    market: "IN",
    price: "$449",
    note: "Storefront",
    tone: "best",
  },
  {
    provider: "Expedia",
    market: "GB",
    price: "$521",
    note: "Proxy GB",
    tone: "default",
  },
];

export default function HeroComparison() {
  return (
    <div className="relative overflow-hidden rounded-[28px] border border-pp-border bg-pp-white shadow-pp-soft">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top_right,rgba(70,137,255,0.16),transparent_55%)]" />

      <div className="relative border-b border-pp-border px-5 py-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-pp-muted">
              Market Lens preview
            </p>
            <h3 className="mt-1 text-lg font-semibold tracking-tight text-pp-text">
              Dubai · Dec 10–13 · 2 adults
            </h3>
          </div>
          <Badge tone="accent">
            <span className="pp-pulse-dot h-1.5 w-1.5 rounded-full bg-pp-accent" />
            Illustrative preview
          </Badge>
        </div>
      </div>

      <div className="relative grid gap-4 p-5 sm:p-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-3">
          {rows.map((row) => (
            <div
              key={`${row.provider}-${row.market}`}
              className={`flex items-center justify-between rounded-2xl border px-4 py-3 ${
                row.tone === "best"
                  ? "border-pp-success/40 bg-pp-success/10"
                  : "border-pp-border bg-pp-bg"
              }`}
            >
              <div>
                <p className="text-sm font-medium text-pp-text">{row.provider}</p>
                <p className="mt-0.5 text-xs text-pp-muted">
                  Market {row.market} · {row.note}
                </p>
              </div>
              <div className="text-right">
                <p className="text-base font-semibold text-pp-text">{row.price}</p>
                {row.tone === "best" ? (
                  <p className="text-[11px] font-medium text-emerald-700">
                    Best offer
                  </p>
                ) : (
                  <p className="text-[11px] text-pp-muted">Sample</p>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-pp-border bg-pp-dark p-4 text-white">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.14em] text-white/50">
              Investigation activity
            </p>
            <span className="inline-flex items-center gap-1.5 text-[11px] text-pp-success">
              <span className="pp-pulse-dot h-1.5 w-1.5 rounded-full bg-pp-success" />
              Preview feed
            </span>
          </div>
          <ul className="mt-4 space-y-3 text-sm text-white/75">
            <li>Agent queued · Booking.com × Germany</li>
            <li>Navigating provider search</li>
            <li>Extracting room rate + fees</li>
            <li>Comparing eligibility across markets</li>
          </ul>
          <div className="mt-5 rounded-xl bg-white/5 p-3">
            <p className="text-xs text-white/50">Highlighted recommendation</p>
            <p className="mt-1 text-lg font-semibold tracking-tight">
              $449 · lowest illustrated total
            </p>
            <p className="mt-1 text-xs text-white/55">
              Sample data for product demonstration — not a live finding.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
