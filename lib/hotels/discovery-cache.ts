/**
 * Short-lived hotel discovery cache.
 * Keys are destination-scoped so Dubai results cannot satisfy a Singapore query.
 * Errors are not stored.
 */

const TTL_MS = 10 * 60 * 1000;

type Entry = { at: number; value: unknown };

const store = new Map<string, Entry>();
const inflight = new Map<string, Promise<unknown>>();

export function discoveryCacheKey({
  query,
  city,
  country,
  countryCode,
  language = "en",
  mode = "named",
}: {
  query: string;
  city?: string | null;
  country?: string | null;
  countryCode?: string | null;
  language?: string;
  mode?: string;
}) {
  return [
    mode,
    norm(query),
    norm(city),
    norm(country),
    norm(countryCode).toUpperCase(),
    norm(language),
  ].join("|");
}

export function readDiscoveryCache(key: string, now = Date.now()) {
  const hit = store.get(key);
  if (!hit) return null;
  if (now - hit.at > TTL_MS) {
    store.delete(key);
    return null;
  }
  return hit.value;
}

export function writeDiscoveryCache(key: string, value: unknown, now = Date.now()) {
  store.set(key, { at: now, value });
}

export async function withDiscoveryCache<T extends { error?: string | null; configured?: boolean }>(
  key: string,
  load: () => Promise<T>,
): Promise<{ value: T; cached: boolean }> {
  const cached = readDiscoveryCache(key) as T | null;
  if (cached) return { value: cached, cached: true };

  const pending = inflight.get(key) as Promise<T> | undefined;
  if (pending) return { value: await pending, cached: true };

  const promise = load()
    .then((value) => {
      if (value && value.configured !== false && !value.error) {
        writeDiscoveryCache(key, value);
      }
      return value;
    })
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, promise);
  return { value: await promise, cached: false };
}

export function clearDiscoveryCache() {
  store.clear();
  inflight.clear();
}

function norm(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}
