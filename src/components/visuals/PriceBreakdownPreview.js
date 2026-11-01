import Badge from "@/components/ui/Badge";
import { TRUE_COST_PREVIEW } from "@/lib/constants";

const kindStyles = {
  confirmed: "text-emerald-700 bg-pp-success/15",
  estimated: "text-amber-800 bg-pp-highlight/25",
  unknown: "text-pp-coral bg-pp-coral/10",
};

export default function PriceBreakdownPreview() {
  const rows = [TRUE_COST_PREVIEW.basePrice, ...TRUE_COST_PREVIEW.fees];

  return (
    <div className="overflow-hidden rounded-[28px] border border-pp-border bg-pp-white shadow-pp-soft">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-pp-border px-5 py-4 sm:px-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-pp-muted">
            True Cost Engine
          </p>
          <h3 className="mt-1 text-lg font-semibold text-pp-text">
            Price anatomy preview
          </h3>
        </div>
        <Badge tone="muted">Illustrative breakdown</Badge>
      </div>

      <div className="space-y-3 p-5 sm:p-6">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between gap-4 rounded-2xl border border-pp-border bg-pp-bg px-4 py-3"
          >
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-pp-text">{row.label}</span>
              <span
                className={`rounded-md px-2 py-0.5 text-[11px] font-medium capitalize ${kindStyles[row.kind]}`}
              >
                {row.kind}
              </span>
            </div>
            <span className="text-sm font-semibold text-pp-text">{row.amount}</span>
          </div>
        ))}
      </div>

      <div className="grid gap-3 border-t border-pp-border bg-pp-bg-secondary p-5 sm:grid-cols-2 sm:p-6">
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-pp-muted">
            Confirmed total
          </p>
          <p className="mt-1 text-2xl font-semibold text-pp-text">
            {TRUE_COST_PREVIEW.totalConfirmed}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-pp-muted">
            With estimates
          </p>
          <p className="mt-1 text-2xl font-semibold text-pp-text">
            {TRUE_COST_PREVIEW.totalWithEstimates}
          </p>
        </div>
        <p className="sm:col-span-2 text-sm text-pp-muted">
          {TRUE_COST_PREVIEW.unknownNote}
        </p>
      </div>
    </div>
  );
}
