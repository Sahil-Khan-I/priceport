"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Container from "@/components/ui/Container";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import {
  COMPARISON_CURRENCIES,
  HOME_COUNTRIES,
  INVESTIGATION_MARKETS,
} from "@/lib/markets/config";

const PROVIDERS = [
  { id: "booking", name: "Booking.com" },
  { id: "agoda", name: "Agoda" },
  { id: "expedia", name: "Expedia" },
  { id: "official", name: "Official hotel website" },
];

const fieldClass =
  "mt-2 w-full rounded-xl border border-pp-border bg-pp-bg px-3 py-3 text-sm outline-none focus:border-pp-accent";

export default function SearchWorkflow() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [query, setQuery] = useState("");
  const [directUrl, setDirectUrl] = useState("");
  const [discovering, setDiscovering] = useState(false);
  const [discoverError, setDiscoverError] = useState("");
  const [candidates, setCandidates] = useState<any[]>([]);
  const [hotel, setHotel] = useState<any>(null);

  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [childrenAges, setChildrenAges] = useState<number[]>([]);
  const [rooms, setRooms] = useState(1);

  const [homeCountry, setHomeCountry] = useState("IN");
  const [preferredCurrency, setPreferredCurrency] = useState("USD");
  const [markets, setMarkets] = useState<string[]>(["GB", "DE"]);
  const [marketAccess, setMarketAccess] = useState<Record<string, string>>({});
  const [selectedProviders, setSelectedProviders] = useState<string[]>(["booking"]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const formError = useMemo(() => {
    if (!checkIn || !checkOut) return "Select check-in and check-out dates.";
    if (checkOut <= checkIn) return "Check-out must be after check-in.";
    if (adults < 1) return "At least one adult is required.";
    if (children > 0 && childrenAges.length !== children) {
      return "Provide an age for each child.";
    }
    return "";
  }, [checkIn, checkOut, adults, children, childrenAges]);

  async function onDiscover(event) {
    event.preventDefault();
    setDiscoverError("");
    setDiscovering(true);
    setCandidates([]);
    try {
      const response = await fetch("/api/hotels/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: query.trim() || undefined,
          directUrl: directUrl.trim() || undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Discovery failed");
      if (!data.configured) {
        setDiscoverError(data.error || "TinyFish is not configured.");
        return;
      }
      if (!data.results?.length) {
        setDiscoverError(
          "No hotel candidates were returned. Try a more specific query or paste a direct property URL.",
        );
        return;
      }
      setCandidates(data.results);
    } catch (error) {
      setDiscoverError(error instanceof Error ? error.message : "Discovery failed");
    } finally {
      setDiscovering(false);
    }
  }

  function selectHotel(candidate) {
    setHotel(candidate);
    setStep(2);
  }

  function toggleMarket(code) {
    setMarkets((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );
  }

  function toggleProvider(id) {
    setSelectedProviders((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  }

  async function startInvestigation() {
    setSubmitError("");
    if (!hotel) {
      setSubmitError("Select a hotel first.");
      return;
    }
    if (formError) {
      setSubmitError(formError);
      return;
    }
    if (!markets.length) {
      setSubmitError("Select at least one market.");
      return;
    }
    if (!selectedProviders.length) {
      setSubmitError("Select at least one provider.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/investigations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hotel: {
            name: hotel.name,
            location: hotel.location,
            address: hotel.address,
            providerUrl: hotel.providerUrl,
            officialWebsite: hotel.officialWebsite,
            evidence: hotel.evidence,
          },
          bookingDetails: {
            checkIn,
            checkOut,
            adults: Number(adults),
            children: Number(children),
            childrenAges,
            rooms: Number(rooms),
          },
          homeCountry,
          preferredCurrency,
          providers: selectedProviders,
          markets,
          marketAccess,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not start investigation");
      router.push(`/investigate/${data.id}`);
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Could not start investigation",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Container className="py-12 sm:py-16">
      <div className="mb-8">
        <Badge tone="accent">Live investigation</Badge>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-pp-text sm:text-4xl">
          Hotel search
        </h1>
        <p className="mt-3 max-w-2xl text-pp-muted">
          Discover a property, set stay details, choose markets and providers,
          then launch real TinyFish investigations. No demo prices.
        </p>
      </div>

      <ol className="mb-8 flex flex-wrap gap-2 text-sm">
        {["Find hotel", "Stay details", "Markets & providers"].map((label, i) => (
          <li
            key={label}
            className={`rounded-full px-3 py-1 ${
              step === i + 1
                ? "bg-pp-accent text-white"
                : "bg-pp-bg-secondary text-pp-muted"
            }`}
          >
            {i + 1}. {label}
          </li>
        ))}
      </ol>

      {step === 1 ? (
        <section className="space-y-6">
          <form
            onSubmit={onDiscover}
            className="rounded-[24px] border border-pp-border bg-pp-white p-5 sm:p-6"
          >
            <label className="block text-sm font-medium text-pp-text">
              Hotel name or destination
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Atlantis The Palm, Dubai"
                className={fieldClass}
              />
            </label>
            <label className="mt-4 block text-sm font-medium text-pp-text">
              Or paste a direct property URL
              <input
                value={directUrl}
                onChange={(e) => setDirectUrl(e.target.value)}
                placeholder="https://www.booking.com/hotel/..."
                className={fieldClass}
              />
            </label>
            <div className="mt-5">
              <Button type="submit" disabled={discovering}>
                {discovering ? "Searching…" : "Discover hotels"}
              </Button>
            </div>
            {discoverError ? (
              <p className="mt-4 text-sm text-pp-coral">{discoverError}</p>
            ) : null}
          </form>

          {candidates.length > 0 ? (
            <div className="space-y-3">
              <p className="text-sm text-pp-muted">
                Select the exact property. Similar names are not auto-merged.
              </p>
              {candidates.map((candidate) => (
                <button
                  key={candidate.id}
                  type="button"
                  onClick={() => selectHotel(candidate)}
                  className="w-full rounded-2xl border border-pp-border bg-pp-white p-4 text-left transition hover:border-pp-accent/40"
                >
                  <p className="font-medium text-pp-text">{candidate.name}</p>
                  <p className="mt-1 text-sm text-pp-muted">
                    {[candidate.location, candidate.address]
                      .filter(Boolean)
                      .join(" · ") || "Location not provided by search result"}
                  </p>
                  {candidate.providerUrl ? (
                    <p className="mt-2 truncate text-xs text-pp-accent">
                      {candidate.providerUrl}
                    </p>
                  ) : null}
                </button>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {step === 2 ? (
        <section className="rounded-[24px] border border-pp-border bg-pp-white p-5 sm:p-6">
          <p className="text-sm text-pp-muted">Selected property</p>
          <p className="mt-1 text-lg font-semibold text-pp-text">{hotel?.name}</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Field label="Check-in">
              <input
                type="date"
                value={checkIn}
                onChange={(e) => setCheckIn(e.target.value)}
                className={fieldClass}
              />
            </Field>
            <Field label="Check-out">
              <input
                type="date"
                value={checkOut}
                onChange={(e) => setCheckOut(e.target.value)}
                className={fieldClass}
              />
            </Field>
            <Field label="Adults">
              <input
                type="number"
                min="1"
                value={adults}
                onChange={(e) => setAdults(Number(e.target.value))}
                className={fieldClass}
              />
            </Field>
            <Field label="Children">
              <input
                type="number"
                min="0"
                value={children}
                onChange={(e) => {
                  const next = Number(e.target.value);
                  setChildren(next);
                  setChildrenAges((ages) =>
                    Array.from({ length: next }, (_, i) => ages[i] ?? 8),
                  );
                }}
                className={fieldClass}
              />
            </Field>
            <Field label="Rooms">
              <input
                type="number"
                min="1"
                value={rooms}
                onChange={(e) => setRooms(Number(e.target.value))}
                className={fieldClass}
              />
            </Field>
            <Field label="Home country">
              <select
                value={homeCountry}
                onChange={(e) => setHomeCountry(e.target.value)}
                className={fieldClass}
              >
                {HOME_COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Preferred comparison currency">
              <select
                value={preferredCurrency}
                onChange={(e) => setPreferredCurrency(e.target.value)}
                className={fieldClass}
              >
                {COMPARISON_CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {children > 0 ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {childrenAges.map((age, index) => (
                <Field key={`age-${index}`} label={`Child ${index + 1} age`}>
                  <input
                    type="number"
                    min="0"
                    max="17"
                    value={age}
                    onChange={(e) => {
                      const value = Number(e.target.value);
                      setChildrenAges((ages) =>
                        ages.map((a, i) => (i === index ? value : a)),
                      );
                    }}
                    className={fieldClass}
                  />
                </Field>
              ))}
            </div>
          ) : null}

          {formError ? (
            <p className="mt-4 text-sm text-pp-coral">{formError}</p>
          ) : null}

          <div className="mt-6 flex gap-3">
            <Button type="button" variant="secondary" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button
              type="button"
              onClick={() => !formError && setStep(3)}
              disabled={Boolean(formError)}
            >
              Continue
            </Button>
          </div>
        </section>
      ) : null}

      {step === 3 ? (
        <section className="space-y-6">
          <div className="rounded-[24px] border border-pp-border bg-pp-white p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-pp-text">Markets</h2>
            <p className="mt-1 text-sm text-pp-muted">
              Proxy markets use documented TinyFish countries only. India and UAE
              are storefront-only — not local IP investigations.
            </p>
            <div className="mt-4 space-y-3">
              {INVESTIGATION_MARKETS.map((market) => {
                const selected = markets.includes(market.code);
                return (
                  <div
                    key={market.code}
                    className="rounded-2xl border border-pp-border p-4"
                  >
                    <label className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleMarket(market.code)}
                        className="mt-1"
                      />
                      <span>
                        <span className="font-medium text-pp-text">
                          {market.name}
                        </span>
                        <span className="mt-1 block text-xs text-pp-muted">
                          {market.note}
                        </span>
                      </span>
                    </label>
                    {selected && !market.proxySupported ? (
                      <p className="mt-3 text-xs text-amber-700">
                        Actual proxy access for this market is not currently
                        supported. A regional storefront investigation may be
                        available separately.
                      </p>
                    ) : null}
                    {selected && market.proxySupported ? (
                      <select
                        className={`${fieldClass} max-w-xs`}
                        value={marketAccess[market.code] || "proxy"}
                        onChange={(e) =>
                          setMarketAccess((prev) => ({
                            ...prev,
                            [market.code]: e.target.value,
                          }))
                        }
                      >
                        <option value="proxy">TinyFish proxy</option>
                        <option value="storefront">Regional storefront only</option>
                      </select>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-[24px] border border-pp-border bg-pp-white p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-pp-text">Providers</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {PROVIDERS.map((provider) => (
                <label
                  key={provider.id}
                  className="flex items-center gap-3 rounded-2xl border border-pp-border p-4"
                >
                  <input
                    type="checkbox"
                    checked={selectedProviders.includes(provider.id)}
                    onChange={() => toggleProvider(provider.id)}
                  />
                  <span className="text-sm font-medium text-pp-text">
                    {provider.name}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {submitError ? (
            <p className="text-sm text-pp-coral">{submitError}</p>
          ) : null}

          <div className="flex gap-3">
            <Button type="button" variant="secondary" onClick={() => setStep(2)}>
              Back
            </Button>
            <Button
              type="button"
              onClick={startInvestigation}
              disabled={submitting}
            >
              {submitting ? "Starting…" : "Start investigation"}
            </Button>
          </div>
        </section>
      ) : null}
    </Container>
  );
}

function Field({ label, children }) {
  return (
    <label className="block text-sm font-medium text-pp-text">
      {label}
      {children}
    </label>
  );
}
