"use client";

import { useMemo, useState, type FormEvent } from "react";
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
  { id: "booking", name: "Booking.com", detail: "Global accommodation marketplace", mark: "B" },
  { id: "agoda", name: "Agoda", detail: "Strong Asia-Pacific coverage", mark: "A" },
  { id: "expedia", name: "Expedia", detail: "International hotel inventory", mark: "E" },
  { id: "official", name: "Hotel website", detail: "Compare the property's direct rate", mark: "↗" },
];

const MARKET_GROUPS = [
  { name: "Asia & Middle East", codes: ["IN", "AE", "JP", "AU"] },
  { name: "Europe", codes: ["GB", "DE", "FR"] },
  { name: "Americas", codes: ["US", "CA"] },
];

const FLAGS: Record<string, string> = {
  IN: "🇮🇳", AE: "🇦🇪", GB: "🇬🇧", DE: "🇩🇪", US: "🇺🇸",
  FR: "🇫🇷", JP: "🇯🇵", AU: "🇦🇺", CA: "🇨🇦",
};

const fieldClass =
  "mt-2 w-full rounded-xl border border-pp-border bg-white px-3.5 py-3 text-sm text-pp-text outline-none transition placeholder:text-pp-muted/65 focus:border-pp-accent focus:ring-4 focus:ring-pp-accent/10";

type HotelCandidate = {
  id: string;
  name: string;
  location?: string | null;
  address?: string | null;
  providerUrl?: string | null;
  officialWebsite?: string | null;
  evidence?: string[];
  snippet?: string | null;
};

export default function SearchWorkflow() {
  const router = useRouter();
  const [inputMode, setInputMode] = useState<"name" | "url">("name");
  const [query, setQuery] = useState("");
  const [directUrl, setDirectUrl] = useState("");
  const [discovering, setDiscovering] = useState(false);
  const [discoverError, setDiscoverError] = useState("");
  const [candidates, setCandidates] = useState<HotelCandidate[]>([]);
  const [hotel, setHotel] = useState<HotelCandidate | null>(null);

  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [childrenAges, setChildrenAges] = useState<number[]>([]);
  const [rooms, setRooms] = useState(1);

  const [homeCountry, setHomeCountry] = useState("IN");
  const [preferredCurrency, setPreferredCurrency] = useState("INR");
  const [markets, setMarkets] = useState<string[]>(["IN", "GB", "DE"]);
  const [marketAccess, setMarketAccess] = useState<Record<string, string>>({});
  const [marketFilter, setMarketFilter] = useState("");
  const [selectedProviders, setSelectedProviders] = useState<string[]>(["booking", "agoda"]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const formError = useMemo(() => {
    if (!hotel) return "Choose a hotel before starting the comparison.";
    if (!checkIn || !checkOut) return "Add your check-in and check-out dates.";
    if (checkOut <= checkIn) return "Check-out must be after check-in.";
    if (adults < 1) return "At least one adult is required.";
    if (children > 0 && childrenAges.length !== children) return "Add an age for every child.";
    if (!markets.length) return "Choose at least one market to compare.";
    if (!selectedProviders.length) return "Choose at least one booking source.";
    return "";
  }, [hotel, checkIn, checkOut, adults, children, childrenAges, markets, selectedProviders]);

  const marketByCode = useMemo(
    () => new Map(INVESTIGATION_MARKETS.map((market) => [market.code, market])),
    [],
  );

  const filteredMarkets = useMemo(() => {
    const term = marketFilter.trim().toLowerCase();
    if (!term) return INVESTIGATION_MARKETS;
    return INVESTIGATION_MARKETS.filter(
      (market) =>
        market.name.toLowerCase().includes(term) ||
        market.code.toLowerCase().includes(term) ||
        market.currency.toLowerCase().includes(term),
    );
  }, [marketFilter]);

  const selectedMarketDetails = markets
    .map((code) => marketByCode.get(code))
    .filter(Boolean);

  async function onDiscover(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setDiscoverError("");
    setSubmitError("");
    setHotel(null);
    setDiscovering(true);
    setCandidates([]);

    const value = inputMode === "name" ? query.trim() : directUrl.trim();
    if (!value) {
      setDiscoverError(inputMode === "name" ? "Enter a hotel name and city." : "Paste a hotel or booking page URL.");
      setDiscovering(false);
      return;
    }

    try {
      const response = await fetch("/api/hotels/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          inputMode === "name" ? { query: value } : { directUrl: value },
        ),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Hotel search failed.");
      if (!data.configured) throw new Error(data.error || "TinyFish is not configured.");
      if (!data.results?.length) {
        setDiscoverError("No properties found. Try the full hotel name and city, or paste a direct property page URL.");
        return;
      }
      setCandidates(data.results);
      if (inputMode === "url" && data.results.length === 1) {
        // A pasted URL is a starting point, not proof of property identity.
        setHotel(data.results[0]);
      }
    } catch (error) {
      setDiscoverError(error instanceof Error ? error.message : "Hotel search failed.");
    } finally {
      setDiscovering(false);
    }
  }

  function toggleMarket(code: string) {
    setMarkets((current) =>
      current.includes(code) ? current.filter((item) => item !== code) : [...current, code],
    );
  }

  function setMarketMethod(code: string, method: string) {
    setMarketAccess((current) => ({ ...current, [code]: method }));
  }

  function toggleProvider(id: string) {
    setSelectedProviders((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  function selectHotel(candidate: HotelCandidate) {
    setHotel(candidate);
    setSubmitError("");
  }

  async function startInvestigation() {
    setSubmitError("");
    if (formError) {
      setSubmitError(formError);
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/investigations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hotel: {
            name: hotel!.name,
            location: hotel!.location,
            address: hotel!.address,
            providerUrl: hotel!.providerUrl,
            officialWebsite: hotel!.officialWebsite,
            evidence: hotel!.evidence,
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
      if (!response.ok) throw new Error(data.error || "Could not start investigation.");
      router.push(`/investigate/${data.id}`);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Could not start investigation.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f7f8fa]">
      <Container className="max-w-6xl pb-16 pt-9 sm:pt-12">
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-pp-muted">Live price investigation</span>
            </div>
            <h1 className="text-3xl font-semibold tracking-[-0.04em] text-pp-text sm:text-[40px]">Find the same hotel for less.</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-pp-muted sm:text-base">
              Choose a property, set your stay and compare what booking sites show in different countries.
            </p>
          </div>
          <div className="rounded-xl border border-pp-border bg-white px-3.5 py-2 text-xs text-pp-muted">
            <span className="font-semibold text-pp-text">No sample prices</span> · Results come from live investigations
          </div>
        </div>

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-5">
            <section className="overflow-hidden rounded-2xl border border-pp-border bg-white shadow-[0_12px_36px_rgba(20,30,50,0.045)]">
              <div className="border-b border-pp-border px-5 py-4 sm:px-6">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-xs font-bold text-blue-700">01</span>
                  <div>
                    <h2 className="text-sm font-semibold text-pp-text">Which hotel are you looking for?</h2>
                    <p className="text-xs text-pp-muted">Search by property name or start from a booking link.</p>
                  </div>
                </div>
              </div>
              <div className="p-5 sm:p-6">
                <div className="mb-4 inline-flex rounded-xl bg-[#f2f4f7] p-1">
                  <button
                    type="button"
                    onClick={() => { setInputMode("name"); setDiscoverError(""); }}
                    className={`rounded-lg px-4 py-2 text-sm font-medium transition ${inputMode === "name" ? "bg-white text-pp-text shadow-sm" : "text-pp-muted hover:text-pp-text"}`}
                    aria-pressed={inputMode === "name"}
                  >
                    Hotel name
                  </button>
                  <button
                    type="button"
                    onClick={() => { setInputMode("url"); setDiscoverError(""); }}
                    className={`rounded-lg px-4 py-2 text-sm font-medium transition ${inputMode === "url" ? "bg-white text-pp-text shadow-sm" : "text-pp-muted hover:text-pp-text"}`}
                    aria-pressed={inputMode === "url"}
                  >
                    Paste a URL
                  </button>
                </div>

                <form onSubmit={onDiscover}>
                  {inputMode === "name" ? (
                    <label className="block text-sm font-medium text-pp-text">
                      Hotel name and city
                      <div className="relative mt-2">
                        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-lg">⌕</span>
                        <input
                          value={query}
                          onChange={(event) => setQuery(event.target.value)}
                          placeholder="e.g. Atlantis The Palm, Dubai"
                          className={`${fieldClass} mt-0 pl-10 pr-4 py-3.5`}
                        />
                      </div>
                      <span className="mt-2 block text-xs font-normal text-pp-muted">Include the city to help distinguish hotels with similar names.</span>
                    </label>
                  ) : (
                    <label className="block text-sm font-medium text-pp-text">
                      Hotel or booking page URL
                      <input
                        type="url"
                        value={directUrl}
                        onChange={(event) => setDirectUrl(event.target.value)}
                        placeholder="https://www.booking.com/hotel/..."
                        className={`${fieldClass} py-3.5`}
                      />
                      <span className="mt-2 block text-xs font-normal text-pp-muted">Paste a Booking.com, Agoda, Expedia or official hotel page. We’ll use it as the starting point and still need to verify the property.</span>
                    </label>
                  )}
                  <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                    <Button type="submit" disabled={discovering} className="min-w-40">
                      {discovering ? "Searching live…" : "Find hotel"}
                      {!discovering ? <span aria-hidden="true">↗</span> : null}
                    </Button>
                    <span className="text-xs text-pp-muted">Discovery runs through TinyFish Search.</span>
                  </div>
                </form>

                {discoverError ? (
                  <div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{discoverError}</div>
                ) : null}

                {candidates.length > 0 ? (
                  <div className="mt-6 border-t border-pp-border pt-5">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-pp-text">Choose the exact property</h3>
                        <p className="mt-0.5 text-xs text-pp-muted">{candidates.length} live search result{candidates.length === 1 ? "" : "s"} · Check the location before selecting.</p>
                      </div>
                      <Badge tone="accent">Live discovery</Badge>
                    </div>
                    <div className="space-y-2">
                      {candidates.map((candidate) => {
                        const active = hotel?.id === candidate.id;
                        return (
                          <button
                            key={candidate.id}
                            type="button"
                            onClick={() => selectHotel(candidate)}
                            aria-pressed={active}
                            className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left transition ${active ? "border-blue-400 bg-blue-50/60 ring-2 ring-blue-100" : "border-pp-border bg-white hover:border-slate-300 hover:bg-slate-50"}`}
                          >
                            <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${active ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300 bg-white"}`}>
                              {active ? <span className="text-xs">✓</span> : null}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-semibold text-pp-text">{candidate.name}</span>
                              <span className="mt-1 block text-xs text-pp-muted">{[candidate.location, candidate.address].filter(Boolean).join(" · ") || "Location not supplied by search result"}</span>
                              {candidate.providerUrl ? <span className="mt-2 block truncate text-xs text-blue-700">{candidate.providerUrl}</span> : null}
                              {candidate.snippet ? <span className="mt-2 block text-xs leading-5 text-pp-muted">{candidate.snippet}</span> : null}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {hotel ? (
                  <div className="mt-4 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
                    <span className="mt-0.5 text-emerald-700">✓</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Selected property</p>
                      <p className="mt-1 text-sm font-semibold text-pp-text">{hotel.name}</p>
                      <p className="mt-0.5 text-xs text-pp-muted">{hotel.location || hotel.address || "Confirm the property location in the results."}</p>
                    </div>
                    <button type="button" onClick={() => setHotel(null)} className="text-xs font-medium text-emerald-800 underline underline-offset-2">Change</button>
                  </div>
                ) : null}
              </div>
            </section>

            <section className="rounded-2xl border border-pp-border bg-white p-5 shadow-[0_12px_36px_rgba(20,30,50,0.035)] sm:p-6">
              <SectionHeading number="02" title="When are you staying?" subtitle="Every market will be checked against the same dates and guest details." />
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <Field label="Check-in">
                  <input type="date" value={checkIn} onChange={(event) => setCheckIn(event.target.value)} className={fieldClass} />
                </Field>
                <Field label="Check-out">
                  <input type="date" value={checkOut} onChange={(event) => setCheckOut(event.target.value)} min={checkIn || undefined} className={fieldClass} />
                </Field>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3">
                <Field label="Adults">
                  <input type="number" min="1" value={adults} onChange={(event) => setAdults(Math.max(1, Number(event.target.value)))} className={fieldClass} />
                </Field>
                <Field label="Children">
                  <input type="number" min="0" value={children} onChange={(event) => {
                    const next = Math.max(0, Number(event.target.value));
                    setChildren(next);
                    setChildrenAges((ages) => Array.from({ length: next }, (_, index) => ages[index] ?? 8));
                  }} className={fieldClass} />
                </Field>
                <Field label="Rooms">
                  <input type="number" min="1" value={rooms} onChange={(event) => setRooms(Math.max(1, Number(event.target.value)))} className={fieldClass} />
                </Field>
              </div>
              {children > 0 ? (
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {childrenAges.map((age, index) => (
                    <Field key={index} label={`Child ${index + 1} age`}>
                      <input type="number" min="0" max="17" value={age} onChange={(event) => setChildrenAges((ages) => ages.map((value, i) => i === index ? Number(event.target.value) : value))} className={fieldClass} />
                    </Field>
                  ))}
                </div>
              ) : null}
            </section>

            <section className="rounded-2xl border border-pp-border bg-white p-5 shadow-[0_12px_36px_rgba(20,30,50,0.035)] sm:p-6">
              <SectionHeading number="03" title="Where should we check prices?" subtitle="Choose the countries whose booking experiences you want to compare." />
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <Field label="Your home country">
                  <select value={homeCountry} onChange={(event) => setHomeCountry(event.target.value)} className={fieldClass}>
                    {HOME_COUNTRIES.map((country) => <option key={country.code} value={country.code}>{FLAGS[country.code] || "🌐"} {country.name}</option>)}
                  </select>
                </Field>
                <Field label="Show totals in">
                  <select value={preferredCurrency} onChange={(event) => setPreferredCurrency(event.target.value)} className={fieldClass}>
                    {COMPARISON_CURRENCIES.map((currency) => <option key={currency} value={currency}>{currency}</option>)}
                  </select>
                </Field>
              </div>

              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-pp-text">Compare across markets</p>
                  <p className="mt-0.5 text-xs text-pp-muted">Select more than one country to compare regional pricing.</p>
                </div>
                <span className="w-fit rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">{markets.length} selected</span>
              </div>

              <div className="relative mt-3">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-pp-muted">⌕</span>
                <input value={marketFilter} onChange={(event) => setMarketFilter(event.target.value)} placeholder="Find a country…" className={`${fieldClass} mt-0 pl-9`} />
              </div>

              <div className="mt-4 space-y-5">
                {MARKET_GROUPS.map((group) => {
                  const groupMarkets = filteredMarkets.filter((market) => group.codes.includes(market.code));
                  if (!groupMarkets.length) return null;
                  return (
                    <div key={group.name}>
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.13em] text-pp-muted">{group.name}</p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {groupMarkets.map((market) => {
                          const selected = markets.includes(market.code);
                          const access = marketAccess[market.code] || market.defaultAccessMethod;
                          return (
                            <div key={market.code} className={`rounded-xl border p-3 transition ${selected ? "border-blue-300 bg-blue-50/45" : "border-pp-border bg-white hover:border-slate-300"}`}>
                              <label className="flex cursor-pointer items-start gap-3">
                                <input type="checkbox" checked={selected} onChange={() => toggleMarket(market.code)} className="mt-1 h-4 w-4 rounded border-slate-300 accent-blue-600" />
                                <span className="min-w-0 flex-1">
                                  <span className="flex items-center gap-2 text-sm font-semibold text-pp-text">
                                    <span className="text-base">{FLAGS[market.code] || "🌐"}</span>
                                    {market.name}
                                  </span>
                                  <span className="mt-1 block text-xs text-pp-muted">{market.currency} · {market.code}</span>
                                  <span className={`mt-2 inline-flex rounded-full px-2 py-1 text-[10px] font-semibold ${market.proxySupported ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>
                                    {market.proxySupported ? "Proxy supported" : "Storefront only"}
                                  </span>
                                </span>
                              </label>
                              {selected && market.proxySupported ? (
                                <div className="mt-3 border-t border-blue-100 pt-2">
                                  <label className="flex items-center justify-between gap-2 text-xs text-pp-muted">
                                    Access method
                                    <select value={access} onChange={(event) => setMarketMethod(market.code, event.target.value)} className="rounded-lg border border-pp-border bg-white px-2 py-1.5 text-xs font-medium text-pp-text">
                                      <option value="proxy">TinyFish proxy</option>
                                      <option value="storefront">Storefront only</option>
                                    </select>
                                  </label>
                                </div>
                              ) : null}
                              {selected && !market.proxySupported ? (
                                <p className="mt-2 border-t border-amber-100 pt-2 text-[11px] leading-4 text-amber-800">Regional storefront context. This is not a local-IP proxy check.</p>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                {filteredMarkets.length === 0 ? <p className="rounded-xl bg-slate-50 p-4 text-sm text-pp-muted">No matching supported market. Try another country name or currency.</p> : null}
              </div>

              <div className="mt-5 rounded-xl bg-[#f6f7f9] p-3.5">
                <p className="text-xs font-semibold text-pp-text">Selected markets</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {selectedMarketDetails.length ? selectedMarketDetails.map((market) => (
                    <span key={market.code} className="inline-flex items-center gap-1.5 rounded-full border border-pp-border bg-white px-2.5 py-1.5 text-xs text-pp-text">
                      {FLAGS[market.code]} {market.name}
                      <button type="button" onClick={() => toggleMarket(market.code)} aria-label={`Remove ${market.name}`} className="ml-0.5 text-pp-muted hover:text-red-600">×</button>
                    </span>
                  )) : <span className="text-xs text-pp-muted">No countries selected yet.</span>}
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-pp-border bg-white p-5 shadow-[0_12px_36px_rgba(20,30,50,0.035)] sm:p-6">
              <SectionHeading number="04" title="Which booking sites should we investigate?" subtitle="Select one or more sources. Each selected source creates its own investigation." />
              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                {PROVIDERS.map((provider) => {
                  const selected = selectedProviders.includes(provider.id);
                  return (
                    <button key={provider.id} type="button" onClick={() => toggleProvider(provider.id)} aria-pressed={selected} className={`flex items-center gap-3 rounded-xl border p-3.5 text-left transition ${selected ? "border-blue-300 bg-blue-50/45" : "border-pp-border hover:border-slate-300"}`}>
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#f0f2f5] text-sm font-bold text-slate-700">{provider.mark}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-pp-text">{provider.name}</span>
                        <span className="mt-0.5 block text-xs text-pp-muted">{provider.detail}</span>
                      </span>
                      <span className={`flex h-5 w-5 items-center justify-center rounded-full border text-xs ${selected ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300 text-transparent"}`}>✓</span>
                    </button>
                  );
                })}
              </div>
            </section>

            {submitError ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{submitError}</div> : null}
          </div>

          <aside className="space-y-4 lg:sticky lg:top-24">
            <div className="rounded-2xl border border-pp-border bg-white p-5 shadow-[0_12px_36px_rgba(20,30,50,0.045)]">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-pp-muted">Your investigation</p>
              <h2 className="mt-2 text-lg font-semibold tracking-tight text-pp-text">Ready when you are.</h2>
              <p className="mt-1 text-xs leading-5 text-pp-muted">Review your choices before starting live browser investigations.</p>

              <div className="my-5 space-y-3 border-y border-pp-border py-4">
                <SummaryRow label="Hotel" value={hotel?.name || "Not selected"} />
                <SummaryRow label="Dates" value={checkIn && checkOut ? `${checkIn} → ${checkOut}` : "Add stay dates"} />
                <SummaryRow label="Guests" value={`${adults} adults · ${children} children · ${rooms} room(s)`} />
                <SummaryRow label="Markets" value={markets.length ? markets.map((code) => FLAGS[code] || code).join(" ") : "None selected"} />
                <SummaryRow label="Booking sites" value={selectedProviders.length ? selectedProviders.map((id) => PROVIDERS.find((item) => item.id === id)?.name).join(", ") : "None selected"} />
                <SummaryRow label="Display currency" value={preferredCurrency} />
              </div>

              <div className="mb-4 rounded-xl bg-[#f5f7fa] p-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-pp-text">Investigation jobs</span>
                  <span className="font-semibold tabular-nums text-pp-text">{markets.length * selectedProviders.length}</span>
                </div>
                <p className="mt-1 text-[11px] leading-4 text-pp-muted">One job per selected booking site and market. More jobs may take longer and use more TinyFish credits.</p>
              </div>

              <Button type="button" block disabled={submitting || Boolean(formError)} onClick={startInvestigation} className="w-full justify-center py-3.5">
                {submitting ? "Starting investigation…" : "Start price investigation"}
                {!submitting ? <span aria-hidden="true">→</span> : null}
              </Button>
              {formError ? <p className="mt-3 text-center text-xs leading-5 text-pp-muted">{formError}</p> : <p className="mt-3 text-center text-[11px] leading-4 text-pp-muted">Live TinyFish runs · No sample prices or simulated offers</p>}
            </div>

            <div className="rounded-2xl border border-pp-border bg-white p-4">
              <p className="text-xs font-semibold text-pp-text">How country comparison works</p>
              <ul className="mt-2 space-y-2 text-xs leading-5 text-pp-muted">
                <li><span className="font-semibold text-pp-text">Proxy supported</span> — TinyFish can request a browser session through the selected country.</li>
                <li><span className="font-semibold text-pp-text">Storefront only</span> — the site may expose a regional version, but this is not a local-IP test.</li>
                <li><span className="font-semibold text-pp-text">Final price</span> — taxes, mandatory fees and room conditions are checked before ranking.</li>
              </ul>
            </div>
          </aside>
        </div>
      </Container>
    </div>
  );
}

function SectionHeading({ number, title, subtitle }: { number: string; title: string; subtitle: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-xs font-bold text-blue-700">{number}</span>
      <div>
        <h2 className="text-sm font-semibold text-pp-text">{title}</h2>
        <p className="mt-1 text-xs leading-5 text-pp-muted">{subtitle}</p>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-xs font-medium text-pp-text">{label}{children}</label>;
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 text-xs">
      <span className="shrink-0 text-pp-muted">{label}</span>
      <span className="max-w-[190px] text-right font-medium text-pp-text">{value}</span>
    </div>
  );
}
