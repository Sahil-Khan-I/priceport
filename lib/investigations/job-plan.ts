/** Pure provider × market planning. Does not start TinyFish jobs. */

export type Pair = { provider: string; market: string };

export function pairKey(provider: string, market: string) {
  return `${String(provider || "").toLowerCase()}|${String(market || "").toUpperCase()}`;
}

export function filterNewPairs(existing: Pair[], incoming: Pair[]) {
  const seen = new Set(existing.map((pair) => pairKey(pair.provider, pair.market)));
  const next: Pair[] = [];
  for (const pair of incoming) {
    const key = pairKey(pair.provider, pair.market);
    if (!pair.provider || !pair.market || seen.has(key)) continue;
    seen.add(key);
    next.push(pair);
  }
  return next;
}

export function expandPairs({
  currentProviders,
  currentMarkets,
  extraProviders = [],
  extraMarkets = [],
}: {
  currentProviders: string[];
  currentMarkets: string[];
  extraProviders?: string[];
  extraMarkets?: string[];
}) {
  const providers = [...currentProviders, ...extraProviders];
  const markets = [...currentMarkets, ...extraMarkets];
  const incoming: Pair[] = [];
  for (const provider of providers) {
    for (const market of markets) {
      incoming.push({ provider, market });
    }
  }
  return filterNewPairs(
    currentProviders.flatMap((provider) =>
      currentMarkets.map((market) => ({ provider, market })),
    ),
    incoming,
  );
}

export const FAST_PROVIDER_IDS = ["booking", "agoda"] as const;
