"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Container from "@/components/ui/Container";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import {
  COMPARISON_CURRENCIES,
  HOME_COUNTRIES,
  INVESTIGATION_MARKETS,
} from "@/lib/markets/config";
import {
  POPULAR_DESTINATIONS,
  searchDestinations,
  type Destination,
} from "@/lib/destinations/catalog";
import {
  countryFlag,
  currencyForHomeCountry,
  inferLocaleHomeCountry,
  previewInvestigationJobs,
  recommendMarkets,
} from "@/lib/markets/recommendations";
import {
  defaultStayDates,
  formatStaySummary,
} from "@/lib/search/defaults";

const fieldClass =
  "w-full rounded-xl border border-pp-border bg-pp-bg px-3 py-3 text-sm outline-none transition focus:border-pp-accent";

type HotelCandidate = {
  id: string;
  name: string;
  location?: string | null;
  address?: string | null;
  providerUrl?: string | null;
  officialWebsite?: string | null;
  evidence?: string[];
  snippet?: string | null;
  discoverySource?: string;
};

export default function SearchWorkflow() {
  const router = useRouter();
  const [step, setStep] = useState(1);

  // Destination + hotel
  const [destinationQuery, setDestinationQuery] = useState("");
  const [destination, setDestination] = useState<Destination | null>(null);
  const [showDestMenu, setShowDestMenu] = useState(false);
  const [hotelQuery, setHotelQuery] = useState("");
  const [hotelSuggestions, setHotelSuggestions] = useState<HotelCandidate[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestError, setSuggestError] = useState("");
  const [showHotelMenu, setShowHotelMenu] = useState(false);
  const [showUrlPanel, setShowUrlPanel] = useState(false);
  const [directUrl, setDirectUrl] = useState("");
  const [urlBusy, setUrlBusy] = useState(false);
  const [hotel, setHotel] = useState<HotelCandidate | null>(null);
  const suggestAbort = useRef<AbortController | null>(null);
  const suggestCache = useRef<Map<string, HotelCandidate[]>>(new Map());

  // Stay — defaults applied after mount to avoid prerender Date() issues
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [childrenAges, setChildrenAges] = useState<number[]>([]);
  const [rooms, setRooms] = useState(1);

  // Traveler + markets
  const [homeCountry, setHomeCountry] = useState("IN");
  const [preferredCurrency, setPreferredCurrency] = useState("INR");
  const [currencyTouched, setCurrencyTouched] = useState(false);
  const [markets, setMarkets] = useState<string[]>(["GB", "US", "DE"]);
  const [marketAccess, setMarketAccess] = useState<Record<string, string>>({
    GB: "proxy",
    US: "proxy",
    DE: "proxy",
  });
  const [marketReason, setMarketReason] = useState<string[]>([]);
  const [marketsTouched, setMarketsTouched] = useState(false);
  const [providers, setProviders] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [selectedProviders, setSelectedProviders] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  function applyMarketDefaults(
    nextHome: string,
    nextDestination: Destination | null,
    force = false,
  ) {
    if (marketsTouched && !force) return;
    const { recommended, reasons } = recommendMarkets({
      homeCountry: nextHome,
      destinationCountryCode: nextDestination?.countryCode || null,
    });
    setMarkets(recommended);
    setMarketReason(reasons);
    setMarketAccess((prev) => {
      const next = { ...prev };
      for (const code of recommended) {
        const market = INVESTIGATION_MARKETS.find((m) => m.code === code);
        if (!next[code]) {
          next[code] = market?.proxySupported ? "proxy" : "storefront";
        }
      }
      return next;
    });
  }

  function updateHomeCountry(code: string) {
    setHomeCountry(code);
    if (!currencyTouched) {
      setPreferredCurrency(currencyForHomeCountry(code));
    }
    applyMarketDefaults(code, destination);
  }

  useEffect(() => {
    let cancelled = false;
    // Defer locale + date defaults so they stay client-only.
    const timer = setTimeout(() => {
      if (cancelled) return;
      const inferred = inferLocaleHomeCountry();
      setHomeCountry(inferred);
      setPreferredCurrency(currencyForHomeCountry(inferred));
      applyMarketDefaults(inferred, null, true);
      const stay = defaultStayDates();
      setCheckIn(stay.checkIn);
      setCheckOut(stay.checkOut);
    }, 0);

    fetch("/api/providers")
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        const list = Array.isArray(json.providers) ? json.providers : [];
        setProviders(list);
        setSelectedProviders(
          list.map((p: any) => p.id).filter((id: string) => id !== "official"),
        );
      })
      .catch(() => {
        if (!cancelled) {
          setProviders([
            { id: "booking", name: "Booking.com" },
            { id: "agoda", name: "Agoda" },
            { id: "expedia", name: "Expedia" },
            { id: "official", name: "Official hotel website" },
          ]);
          setSelectedProviders(["booking", "agoda", "expedia"]);
        }
      });

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced hotel autocomplete via TinyFish Search API.
  useEffect(() => {
    if (hotel || hotelQuery.trim().length < 3) {
      return;
    }

    const key = `${destination?.id || ""}|${hotelQuery.trim().toLowerCase()}`;
    const cached = suggestCache.current.get(key);
    if (cached) {
      const timer = setTimeout(() => {
        setHotelSuggestions(cached);
        setSuggestError("");
        setShowHotelMenu(true);
        setSuggestLoading(false);
      }, 0);
      return () => clearTimeout(timer);
    }

    const timer = setTimeout(async () => {
      suggestAbort.current?.abort();
      const controller = new AbortController();
      suggestAbort.current = controller;
      setSuggestLoading(true);
      setSuggestError("");
      try {
        const params = new URLSearchParams({
          q: hotelQuery.trim(),
          limit: "6",
        });
        if (destination?.searchHint) {
          params.set("destination", destination.searchHint);
          params.set("location", destination.countryCode === "GB" ? "GB" : "US");
        }
        const response = await fetch(`/api/hotels/suggest?${params}`, {
          signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Suggestion failed");
        if (!data.configured) {
          setSuggestError(data.error || "TinyFish is not configured.");
          setHotelSuggestions([]);
          return;
        }
        const results = data.results || [];
        suggestCache.current.set(key, results);
        setHotelSuggestions(results);
        setShowHotelMenu(true);
        if (!results.length) {
          setSuggestError(
            "No hotels found. Try another name or paste a booking link.",
          );
        }
      } catch (error: any) {
        if (error?.name === "AbortError") return;
        setSuggestError(
          error instanceof Error ? error.message : "Suggestion failed",
        );
      } finally {
        setSuggestLoading(false);
      }
    }, 500);

    return () => {
      clearTimeout(timer);
    };
  }, [hotelQuery, destination, hotel]);

  const destinationOptions = useMemo(
    () => searchDestinations(destinationQuery, 8),
    [destinationQuery],
  );

  const formError = useMemo(() => {
    if (!checkIn || !checkOut) return "Select check-in and check-out dates.";
    if (checkOut <= checkIn) return "Check-out must be after check-in.";
    if (adults < 1) return "At least one adult is required.";
    if (children > 0 && childrenAges.length !== children) {
      return "Provide an age for each child.";
    }
    return "";
  }, [checkIn, checkOut, adults, children, childrenAges]);

  const jobPreview = useMemo(
    () =>
      previewInvestigationJobs({
        providers: selectedProviders,
        markets,
        marketAccess,
        hotel,
      }),
    [selectedProviders, markets, marketAccess, hotel],
  );

  const staySummary = formatStaySummary({
    checkIn,
    checkOut,
    adults,
    children,
    rooms,
  });

  function selectDestination(next: Destination) {
    setDestination(next);
    setDestinationQuery(next.label);
    setShowDestMenu(false);
    applyMarketDefaults(homeCountry, next);
  }

  function selectHotel(candidate: HotelCandidate) {
    setHotel({
      ...candidate,
      location: candidate.location || destination?.label || null,
    });
    setHotelQuery(candidate.name);
    setShowHotelMenu(false);
    setSuggestError("");
    setStep(2);
  }

  async function resolveDirectUrl() {
    if (!directUrl.trim()) return;
    setUrlBusy(true);
    setSuggestError("");
    try {
      const response = await fetch("/api/hotels/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          directUrl: directUrl.trim(),
          destination: destination?.label || undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not use that URL");
      const candidate = data.results?.[0];
      if (!candidate) throw new Error("No property could be inferred from that URL");
      selectHotel(candidate);
    } catch (error) {
      setSuggestError(error instanceof Error ? error.message : "URL failed");
    } finally {
      setUrlBusy(false);
    }
  }

  function toggleMarket(code: string) {
    setMarketsTouched(true);
    setMarkets((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );
  }

  function applyRecommendedMarkets() {
    setMarketsTouched(false);
    applyMarketDefaults(homeCountry, destination, true);
  }

  function selectAllProxyMarkets() {
    setMarketsTouched(true);
    const codes = INVESTIGATION_MARKETS.filter((m) => m.proxySupported).map(
      (m) => m.code,
    );
    setMarkets(codes);
  }

  async function startInvestigation() {
    setSubmitError("");
    if (!hotel) {
      setSubmitError("Select a hotel first.");
      setStep(1);
      return;
    }
    if (formError) {
      setSubmitError(formError);
      setStep(2);
      return;
    }
    if (!markets.length) {
      setSubmitError("Select at least one comparison market.");
      return;
    }
    if (!selectedProviders.length) {
      setSubmitError("Select at least one booking provider.");
      return;
    }
    if (jobPreview.executable < 1) {
      setSubmitError(
        "No executable investigation jobs with the current selection.",
      );
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
            location: hotel.location || destination?.label || null,
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
      if (!response.ok) {
        throw new Error(data.error || "Could not start investigation");
      }
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
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 pp-grid-wash opacity-70" />
      <Container className="relative py-10 sm:py-14">
        <div className="mx-auto max-w-3xl text-center">
          <Badge tone="accent">Priceport search</Badge>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-pp-text sm:text-5xl">
            Where are you planning to stay?
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-pp-muted sm:text-lg">
            Find your hotel. We&apos;ll investigate global prices and help you
            discover the best real deal.
          </p>
        </div>

        <ol className="mx-auto mt-8 flex max-w-3xl flex-wrap justify-center gap-2 text-sm">
          {[
            "Destination & hotel",
            "Stay & traveler",
            "Compare globally",
          ].map((label, i) => (
            <li
              key={label}
              className={`rounded-full px-3.5 py-1.5 ${
                step === i + 1
                  ? "bg-pp-accent text-white"
                  : step > i + 1
                    ? "bg-pp-bg-secondary text-pp-text"
                    : "bg-pp-bg-secondary text-pp-muted"
              }`}
            >
              {i + 1}. {label}
            </li>
          ))}
        </ol>

        {/* STEP 1 */}
        {step === 1 ? (
          <section className="mx-auto mt-8 max-w-3xl space-y-5">
            <div className="rounded-[28px] border border-pp-border bg-pp-white p-5 shadow-pp-soft sm:p-7">
              <label className="block text-left text-sm font-medium text-pp-text">
                Destination
                <div className="relative mt-2">
                  <input
                    value={destinationQuery}
                    onChange={(e) => {
                      setDestinationQuery(e.target.value);
                      setDestination(null);
                      setShowDestMenu(true);
                    }}
                    onFocus={() => setShowDestMenu(true)}
                    placeholder="Dubai, Singapore, London…"
                    className={fieldClass}
                    autoComplete="off"
                  />
                  {showDestMenu ? (
                    <div className="absolute z-20 mt-2 max-h-64 w-full overflow-auto rounded-2xl border border-pp-border bg-pp-white shadow-pp-soft">
                      {destinationOptions.length === 0 ? (
                        <p className="px-4 py-3 text-sm text-pp-muted">
                          No destinations match. Try another city.
                        </p>
                      ) : (
                        destinationOptions.map((option) => (
                          <button
                            key={option.id}
                            type="button"
                            className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-pp-bg-secondary"
                            onClick={() => selectDestination(option)}
                          >
                            <span className="text-xl">{option.flag}</span>
                            <span>
                              <span className="block text-sm font-medium text-pp-text">
                                {option.city}
                              </span>
                              <span className="block text-xs text-pp-muted">
                                {option.country}
                              </span>
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  ) : null}
                </div>
              </label>

              {!destination ? (
                <div className="mt-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-pp-muted">
                    Popular destinations
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {POPULAR_DESTINATIONS.slice(0, 8).map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => selectDestination(d)}
                        className="rounded-full border border-pp-border bg-pp-bg px-3 py-1.5 text-sm text-pp-text transition hover:border-pp-accent/40"
                      >
                        {d.flag} {d.city}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-sm text-pp-muted">
                  Selected {destination.flag} {destination.label}
                </p>
              )}

              <label className="mt-6 block text-left text-sm font-medium text-pp-text">
                Hotel
                <div className="relative mt-2">
                  <input
                    value={hotelQuery}
                    onChange={(e) => {
                      const value = e.target.value;
                      setHotel(null);
                      setHotelQuery(value);
                      if (value.trim().length < 3) {
                        setHotelSuggestions([]);
                        setSuggestError("");
                        setShowHotelMenu(false);
                        setSuggestLoading(false);
                      } else {
                        setShowHotelMenu(true);
                      }
                    }}
                    onFocus={() => hotelSuggestions.length && setShowHotelMenu(true)}
                    placeholder={
                      destination
                        ? `Search hotels in ${destination.city}`
                        : "Atlantis The Palm, Marina Bay Sands…"
                    }
                    className={fieldClass}
                    autoComplete="off"
                  />
                  {suggestLoading ? (
                    <p className="mt-2 text-xs text-pp-muted">Searching with TinyFish…</p>
                  ) : null}
                  {showHotelMenu && (hotelSuggestions.length > 0 || suggestError) ? (
                    <div className="absolute z-20 mt-2 max-h-80 w-full overflow-auto rounded-2xl border border-pp-border bg-pp-white shadow-pp-soft">
                      {suggestError && hotelSuggestions.length === 0 ? (
                        <p className="px-4 py-3 text-sm text-pp-muted">{suggestError}</p>
                      ) : (
                        hotelSuggestions.map((candidate) => (
                          <button
                            key={candidate.id}
                            type="button"
                            className="w-full border-b border-pp-border px-4 py-3 text-left last:border-0 hover:bg-pp-bg-secondary"
                            onClick={() => selectHotel(candidate)}
                          >
                            <span className="block text-sm font-medium text-pp-text">
                              {candidate.name}
                            </span>
                            <span className="mt-1 block text-xs text-pp-muted">
                              {[candidate.location, candidate.address]
                                .filter(Boolean)
                                .join(" · ") || "Location from search result"}
                            </span>
                            <span className="mt-1 block truncate text-[11px] text-pp-accent">
                              {candidate.discoverySource || "tinyfish_search"}
                              {candidate.providerUrl
                                ? ` · ${candidate.providerUrl}`
                                : ""}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  ) : null}
                </div>
              </label>

              <div className="mt-5">
                <button
                  type="button"
                  className="text-sm text-pp-accent hover:underline"
                  onClick={() => setShowUrlPanel((v) => !v)}
                >
                  {showUrlPanel
                    ? "Hide booking link option"
                    : "Already found a hotel? Paste its booking link."}
                </button>
                {showUrlPanel ? (
                  <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                    <input
                      value={directUrl}
                      onChange={(e) => setDirectUrl(e.target.value)}
                      placeholder="https://www.booking.com/hotel/…"
                      className={fieldClass}
                    />
                    <Button
                      type="button"
                      onClick={resolveDirectUrl}
                      disabled={urlBusy || !directUrl.trim()}
                    >
                      {urlBusy ? "Checking…" : "Use link"}
                    </Button>
                  </div>
                ) : null}
              </div>

              {hotel ? (
                <div className="mt-6 rounded-2xl border border-pp-border bg-pp-bg-secondary p-4 text-left">
                  <p className="text-xs uppercase tracking-[0.14em] text-pp-muted">
                    Selected property
                  </p>
                  <p className="mt-1 font-semibold text-pp-text">{hotel.name}</p>
                  <p className="mt-1 text-sm text-pp-muted">
                    Discovery candidate — identity will be verified during investigation
                  </p>
                  <div className="mt-4">
                    <Button type="button" onClick={() => setStep(2)}>
                      Continue with this hotel
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        {/* STEP 2 */}
        {step === 2 ? (
          <section className="mx-auto mt-8 max-w-3xl space-y-5">
            <div className="rounded-[28px] border border-pp-border bg-pp-white p-5 shadow-pp-soft sm:p-7">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.14em] text-pp-muted">
                    Selected hotel
                  </p>
                  <p className="mt-1 text-lg font-semibold text-pp-text">
                    {hotel?.name}
                  </p>
                  <p className="mt-1 text-sm text-pp-muted">
                    {hotel?.location || destination?.label || "Location pending"}
                  </p>
                </div>
                <button
                  type="button"
                  className="text-sm text-pp-accent hover:underline"
                  onClick={() => setStep(1)}
                >
                  Change hotel
                </button>
              </div>

              <p className="mt-5 rounded-2xl bg-pp-bg-secondary px-4 py-3 text-sm text-pp-text">
                {staySummary}
              </p>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-medium text-pp-text">
                  Check-in
                  <input
                    type="date"
                    value={checkIn}
                    onChange={(e) => setCheckIn(e.target.value)}
                    className={`mt-2 ${fieldClass}`}
                  />
                </label>
                <label className="text-sm font-medium text-pp-text">
                  Check-out
                  <input
                    type="date"
                    value={checkOut}
                    onChange={(e) => setCheckOut(e.target.value)}
                    className={`mt-2 ${fieldClass}`}
                  />
                </label>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-3">
                <Stepper
                  label="Adults"
                  value={adults}
                  min={1}
                  onChange={setAdults}
                />
                <Stepper
                  label="Children"
                  value={children}
                  min={0}
                  onChange={(next) => {
                    setChildren(next);
                    setChildrenAges((ages) =>
                      Array.from({ length: next }, (_, i) => ages[i] ?? 8),
                    );
                  }}
                />
                <Stepper label="Rooms" value={rooms} min={1} onChange={setRooms} />
              </div>

              {children > 0 ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  {childrenAges.map((age, index) => (
                    <label
                      key={`age-${index}`}
                      className="text-sm font-medium text-pp-text"
                    >
                      Child {index + 1} age
                      <select
                        value={age}
                        onChange={(e) => {
                          const value = Number(e.target.value);
                          setChildrenAges((ages) =>
                            ages.map((a, i) => (i === index ? value : a)),
                          );
                        }}
                        className={`mt-2 ${fieldClass}`}
                      >
                        {Array.from({ length: 18 }, (_, i) => (
                          <option key={i} value={i}>
                            {i}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
              ) : null}

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-medium text-pp-text">
                  Home country
                  <select
                    value={homeCountry}
                    onChange={(e) => updateHomeCountry(e.target.value)}
                    className={`mt-2 ${fieldClass}`}
                  >
                    {HOME_COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {countryFlag(c.code)} {c.name}
                      </option>
                    ))}
                  </select>
                  <span className="mt-1 block text-xs text-pp-muted">
                    Suggested from browser locale — editable. Not proof of residence.
                  </span>
                </label>
                <label className="text-sm font-medium text-pp-text">
                  Preferred currency
                  <select
                    value={preferredCurrency}
                    onChange={(e) => {
                      setCurrencyTouched(true);
                      setPreferredCurrency(e.target.value);
                    }}
                    className={`mt-2 ${fieldClass}`}
                  >
                    {COMPARISON_CURRENCIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {formError ? (
                <p className="mt-4 text-sm text-pp-coral">{formError}</p>
              ) : null}

              <div className="mt-6 flex flex-wrap gap-3">
                <Button type="button" variant="secondary" onClick={() => setStep(1)}>
                  Back
                </Button>
                <Button
                  type="button"
                  onClick={() => !formError && setStep(3)}
                  disabled={Boolean(formError)}
                >
                  Continue to markets
                </Button>
              </div>
            </div>
          </section>
        ) : null}

        {/* STEP 3 */}
        {step === 3 ? (
          <section className="mx-auto mt-8 max-w-3xl space-y-5">
            <div className="rounded-[28px] border border-pp-border bg-pp-white p-5 shadow-pp-soft sm:p-7">
              <h2 className="text-lg font-semibold text-pp-text">
                Compare globally
              </h2>
              <p className="mt-1 text-sm text-pp-muted">
                Recommended markets use the live Priceport configuration. Proxy
                means documented TinyFish proxy; storefront is regional only.
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={applyRecommendedMarkets}
                  className="rounded-full border border-pp-border px-3 py-1.5 text-xs text-pp-text hover:border-pp-accent/40"
                >
                  Recommended
                </button>
                <button
                  type="button"
                  onClick={selectAllProxyMarkets}
                  className="rounded-full border border-pp-border px-3 py-1.5 text-xs text-pp-text hover:border-pp-accent/40"
                >
                  All proxy markets
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMarketsTouched(true);
                    setMarkets([]);
                  }}
                  className="rounded-full border border-pp-border px-3 py-1.5 text-xs text-pp-text hover:border-pp-accent/40"
                >
                  Clear
                </button>
              </div>

              {markets.length ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {markets.map((code) => {
                    const market = INVESTIGATION_MARKETS.find((m) => m.code === code);
                    return (
                      <button
                        key={code}
                        type="button"
                        onClick={() => toggleMarket(code)}
                        className="rounded-full bg-pp-accent/10 px-3 py-1.5 text-sm text-pp-text"
                      >
                        {countryFlag(code)} {market?.name || code} ×
                      </button>
                    );
                  })}
                </div>
              ) : null}

              <div className="mt-5 space-y-2">
                {INVESTIGATION_MARKETS.map((market) => {
                  const selected = markets.includes(market.code);
                  const accessLabel = market.proxySupported
                    ? "Proxy available"
                    : market.storefrontAvailable
                      ? "Storefront only"
                      : "Unsupported";
                  return (
                    <label
                      key={market.code}
                      className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 ${
                        selected
                          ? "border-pp-accent/40 bg-pp-bg-secondary"
                          : "border-pp-border bg-pp-white"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleMarket(market.code)}
                        className="mt-1"
                      />
                      <span className="flex-1">
                        <span className="flex flex-wrap items-center gap-2 text-sm font-medium text-pp-text">
                          <span>{countryFlag(market.code)}</span>
                          <span>{market.name}</span>
                          <span className="rounded-full bg-pp-bg px-2 py-0.5 text-[11px] text-pp-muted">
                            {accessLabel}
                          </span>
                        </span>
                        <span className="mt-1 block text-xs text-pp-muted">
                          {market.note}
                        </span>
                        {selected && market.proxySupported ? (
                          <select
                            className={`mt-2 max-w-xs ${fieldClass}`}
                            value={marketAccess[market.code] || "proxy"}
                            onChange={(e) =>
                              setMarketAccess((prev) => ({
                                ...prev,
                                [market.code]: e.target.value,
                              }))
                            }
                            onClick={(e) => e.stopPropagation()}
                          >
                            <option value="proxy">Use TinyFish proxy</option>
                            <option value="storefront">
                              Regional storefront only
                            </option>
                          </select>
                        ) : null}
                      </span>
                    </label>
                  );
                })}
              </div>

              {marketReason.length ? (
                <ul className="mt-4 space-y-1 text-xs text-pp-muted">
                  {marketReason.map((reason) => (
                    <li key={reason}>• {reason}</li>
                  ))}
                </ul>
              ) : null}
            </div>

            <div className="rounded-[28px] border border-pp-border bg-pp-white p-5 shadow-pp-soft sm:p-7">
              <h2 className="text-lg font-semibold text-pp-text">Providers</h2>
              <p className="mt-1 text-sm text-pp-muted">
                From the live provider registry. Default excludes official site
                unless a property URL was discovered.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {providers.map((provider) => (
                  <label
                    key={provider.id}
                    className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${
                      selectedProviders.includes(provider.id)
                        ? "border-pp-accent/40 bg-pp-bg-secondary"
                        : "border-pp-border"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedProviders.includes(provider.id)}
                      onChange={() =>
                        setSelectedProviders((prev) =>
                          prev.includes(provider.id)
                            ? prev.filter((id) => id !== provider.id)
                            : [...prev, provider.id],
                        )
                      }
                    />
                    <span className="text-sm font-medium text-pp-text">
                      {provider.name}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="rounded-[28px] border border-pp-border bg-pp-bg-secondary p-5 sm:p-6">
              <p className="text-xs uppercase tracking-[0.14em] text-pp-muted">
                Investigation preview
              </p>
              <p className="mt-2 text-base font-medium text-pp-text">
                Compare {hotel?.name || "this hotel"} across {markets.length}{" "}
                market{markets.length === 1 ? "" : "s"} and{" "}
                {selectedProviders.length} provider
                {selectedProviders.length === 1 ? "" : "s"}.
              </p>
              <p className="mt-2 text-sm text-pp-muted">
                {jobPreview.executable} executable TinyFish job
                {jobPreview.executable === 1 ? "" : "s"} will be launched
                {jobPreview.unsupported
                  ? ` · ${jobPreview.unsupported} combination${jobPreview.unsupported === 1 ? "" : "s"} unsupported`
                  : ""}
                .
              </p>
              <p className="mt-2 text-sm text-pp-muted">
                {staySummary} · home {countryFlag(homeCountry)} {homeCountry} ·{" "}
                {preferredCurrency}
              </p>
              {jobPreview.notes.map((note) => (
                <p key={note} className="mt-2 text-xs text-amber-800">
                  {note}
                </p>
              ))}
            </div>

            {submitError ? (
              <p className="text-sm text-pp-coral">{submitError}</p>
            ) : null}

            <div className="flex flex-wrap gap-3">
              <Button type="button" variant="secondary" onClick={() => setStep(2)}>
                Back
              </Button>
              <Button
                type="button"
                onClick={startInvestigation}
                disabled={submitting || jobPreview.executable < 1}
              >
                {submitting
                  ? "Starting investigation…"
                  : `Start ${jobPreview.executable} investigation${jobPreview.executable === 1 ? "" : "s"}`}
              </Button>
            </div>
          </section>
        ) : null}
      </Container>
    </div>
  );
}

function Stepper({
  label,
  value,
  min,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="rounded-2xl border border-pp-border bg-pp-bg px-3 py-3">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-pp-muted">
        {label}
      </p>
      <div className="mt-2 flex items-center justify-between">
        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-pp-border bg-pp-white text-lg text-pp-text"
          onClick={() => onChange(Math.max(min, value - 1))}
          aria-label={`Decrease ${label}`}
        >
          −
        </button>
        <span className="text-lg font-semibold text-pp-text">{value}</span>
        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-pp-border bg-pp-white text-lg text-pp-text"
          onClick={() => onChange(value + 1)}
          aria-label={`Increase ${label}`}
        >
          +
        </button>
      </div>
    </div>
  );
}
