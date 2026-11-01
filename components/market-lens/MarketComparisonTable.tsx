import { MARKET_LENS_PREVIEW_ROWS } from "@/lib/constants";

export default function MarketComparisonTable({ rows = MARKET_LENS_PREVIEW_ROWS }) {
  return (
    <div className="overflow-x-auto rounded-[24px] border border-pp-border bg-pp-white">
      <table className="min-w-[720px] w-full border-collapse text-left text-sm">
        <thead className="bg-pp-bg-secondary text-pp-muted">
          <tr>
            {[
              "Provider",
              "Country",
              "Original",
              "Converted",
              "Total",
              "Availability",
              "Eligibility",
            ].map((heading) => (
              <th key={heading} className="px-4 py-3 font-medium">
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={`${row.provider}-${row.country}`}
              className="border-t border-pp-border"
            >
              <td className="px-4 py-3 font-medium text-pp-text">{row.provider}</td>
              <td className="px-4 py-3 text-pp-muted">{row.country}</td>
              <td className="px-4 py-3 text-pp-text">{row.originalPrice}</td>
              <td className="px-4 py-3 text-pp-text">{row.convertedPrice}</td>
              <td className="px-4 py-3 font-semibold text-pp-text">
                {row.totalCost}
              </td>
              <td className="px-4 py-3 text-pp-muted">{row.availability}</td>
              <td className="px-4 py-3 text-pp-muted">{row.eligibility}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
