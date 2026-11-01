import { MARKET_CONTEXTS } from "@/lib/constants";
import Badge from "@/components/ui/Badge";

export default function MarketSelector({ markets = MARKET_CONTEXTS }) {
  return (
    <div className="rounded-[24px] border border-pp-border bg-pp-white p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-pp-muted">
        Market contexts
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {markets.map((market) => (
          <div
            key={market.code}
            className="flex items-center gap-2 rounded-xl border border-pp-border px-3 py-2"
          >
            <span className="text-sm font-medium text-pp-text">
              {market.name}
            </span>
            <Badge tone={market.proxySupported ? "success" : "warn"}>
              {market.proxySupported ? "Proxy OK" : "No proxy"}
            </Badge>
          </div>
        ))}
      </div>
    </div>
  );
}
