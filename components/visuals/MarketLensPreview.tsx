import Badge from "@/components/ui/Badge";
import { MARKET_LENS_PREVIEW_ROWS } from "@/lib/constants";

export default function MarketLensPreview() {
  return (
    <div className="overflow-hidden rounded-[28px] border border-pp-border bg-pp-white shadow-pp-soft">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-pp-border px-5 py-4 sm:px-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-pp-muted">
            Market Lens
          </p>
          <h3 className="mt-1 text-lg font-semibold text-pp-text">
            Same hotel · different markets
          </h3>
        </div>
        <Badge tone="warn">Product preview · sample prices</Badge>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[760px] w-full border-collapse text-left text-sm">
          <thead className="bg-pp-bg-secondary text-pp-muted">
            <tr>
              {[
                "Provider",
                "Country",
                "Original",
                "Converted",
                "Total cost",
                "Availability",
                "Eligibility",
                "Source",
              ].map((heading) => (
                <th key={heading} className="px-4 py-3 font-medium">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MARKET_LENS_PREVIEW_ROWS.map((row) => (
              <tr
                key={`${row.provider}-${row.country}`}
                className={`border-t border-pp-border ${
                  row.highlight === "lowest"
                    ? "bg-pp-highlight/15"
                    : row.highlight === "bookable"
                      ? "bg-pp-success/8"
                      : "bg-pp-white"
                }`}
              >
                <td className="px-4 py-3.5 font-medium text-pp-text">
                  {row.provider}
                </td>
                <td className="px-4 py-3.5 text-pp-muted">
                  <div className="flex flex-col gap-1">
                    <span>
                      {row.country} ({row.countryCode})
                    </span>
                    {!row.proxySupported ? (
                      <span className="text-[11px] text-amber-700">
                        No TinyFish proxy · storefront path
                      </span>
                    ) : (
                      <span className="text-[11px] text-emerald-700">
                        Proxy supported
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3.5 text-pp-text">
                  {row.originalPrice}
                  <span className="ml-1 text-pp-muted">{row.currency}</span>
                </td>
                <td className="px-4 py-3.5 text-pp-text">{row.convertedPrice}</td>
                <td className="px-4 py-3.5 font-semibold text-pp-text">
                  {row.totalCost}
                </td>
                <td className="px-4 py-3.5 text-pp-muted">{row.availability}</td>
                <td className="px-4 py-3.5 text-pp-muted">{row.eligibility}</td>
                <td className="px-4 py-3.5 text-pp-muted">{row.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 border-t border-pp-border bg-pp-bg p-5 sm:grid-cols-2 sm:p-6">
        <div className="rounded-2xl border border-pp-highlight/50 bg-pp-highlight/20 p-4">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-amber-800">
            Lowest price found
          </p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-pp-text">
            $449
          </p>
          <p className="mt-1 text-sm text-pp-muted">
            Booking.com · India storefront preview. May differ from what you can
            actually book.
          </p>
        </div>
        <div className="rounded-2xl border border-pp-success/40 bg-pp-success/10 p-4">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-emerald-800">
            Cheapest you can book
          </p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-pp-text">
            $478
          </p>
          <p className="mt-1 text-sm text-pp-muted">
            Booking.com · Germany via documented TinyFish proxy DE — eligibility
            clearer in this illustration.
          </p>
        </div>
      </div>
    </div>
  );
}
