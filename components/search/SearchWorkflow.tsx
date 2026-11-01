"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { useRouter } from "next/navigation";
import Container from "@/components/ui/Container";
import Button from "@/components/ui/Button";
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
  "w-full rounded-xl border border-pp-border bg-pp-white px-3.5 py-3 text-sm text-pp-text outline-none transition placeholder:text-pp-muted/70 focus:border-pp-accent focus:ring-2 focus:ring-pp-accent/15";

type HotelCandidate = {
  id: string;
  name: string;
  city?: string | null;
  country?: string | null;
  location?: string | null;
  address?: string | null;
  providerUrl?: string | null;
  officialWebsite?: string | null;
  sourceDomain?: string | null;
  sourceClass?: string;
  evidence?: string[];
  snippet?: string | null;
  relevanceScore?: number;
  discoveryStatus?: string;
  discoverySource?: string;
};

type OpenMenu = "none" | "destination" | "hotel";

export default function SearchWorkflow() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const rootRef = useRef<HTMLDivElement>(null);

  const [destinationQuery, setDestinationQuery] = useState("");
  const [destination, setDestination] = useState<Destination | null>(null);
  const [hotelQuery, setHotelQuery] = useState("");
  const [hotelSuggestions, setHotelSuggestions] = useState<HotelCandidate[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestError, setSuggestError] = useState("");
  const [openMenu, setOpenMenu] = useState<OpenMenu>("none");
  const [hotelHighlight, setHotelHighlight] = useState(0);
  const [destHighlight, setDestHighlight] = useState(0);
  const [showUrlPanel, setShowUrlPanel] = useState(false);
  const [directUrl, setDirectUrl] = useState("");
  const [urlBusy, setUrlBusy] = useState(false);
  const [hotel, setHotel] = useState<HotelCandidate | null>(null);
  const suggestAbort = useRef<AbortController | null>(null);
  const suggestCache = useRef<Map<string, HotelCandidate[]>>(new Map());

  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [childrenAges, setChildrenAges] = useState<number[]>([]);
  const [rooms, setRooms] = useState(1);

  const [homeCountry, setHomeCountry] = useState("IN");
  const [preferredCurrency, setPreferredCurrency] = useState("INR");
  const [currencyTouched, setCurrencyTouched] = useState(false);
  const [markets, setMarkets] = useState<string[]>(["GB", "US"]);
  const [marketAccess, setMarketAccess] = useState<Record<string, string>>({
    GB: "proxy",
    US: "proxy",
  });
  const [marketReason, setMarketReason] = useState<string[]>([]);
  const [marketsTouched, setMarketsTouched] = useState(false);
  const [providers, setProviders] = useState<Array<{ id: string; name: string }>>(
    [],
  );
  const [selectedProviders, setSelectedProviders] = useState<string[]>([
    "booking",
    "agoda",
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const destinationOptions = useMemo(
    () => searchDestinations(destinationQuery, 8),
    [destinationQuery],
  );

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
    if (!currencyTouched) setPreferredCurrency(currencyForHomeCountry(code));
    applyMarketDefaults(code, destination);
  }

  useEffect(() => {
    let cancelled = false;
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
          ["booking", "agoda"].filter((id) =>
            list.some((provider: { id: string }) => provider.id === id),
          ),
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
          setSelectedProviders(["booking", "agoda"]);
        }
      });

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Outside click closes menus
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpenMenu("none");
    }
    function onKey(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape") setOpenMenu("none");
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  // Debounced hotel suggest
  useEffect(() => {
    if (hotel || hotelQuery.trim().length < 3 || !destination) return;

    const key = `${destination.countryCode}|${destination.city}|${hotelQuery.trim().toLowerCase()}`;
    const cached = suggestCache.current.get(key);
    if (cached) {
      const t = setTimeout(() => {
        setHotelSuggestions(cached);
        setSuggestError(cached.length ? "" : "No reliable matches found.");
        setOpenMenu("hotel");
        setHotelHighlight(0);
        setSuggestLoading(false);
      }, 0);
      return () => clearTimeout(t);
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
          destination: destination.label,
          city: destination.city,
          country: destination.country,
          countryCode: destination.countryCode,
        });
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
        setOpenMenu("hotel");
        setHotelHighlight(0);
        if (!results.length) {
          setSuggestError(
            "No reliable matches found. Try another hotel name or change your destination.",
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
    }, 450);

    return () => clearTimeout(timer);
  }, [hotelQuery, destination, hotel]);

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
    setOpenMenu("none");
    applyMarketDefaults(homeCountry, next);
    if (hotel && hotelQuery) {
      // Force re-suggest under new destination context
      suggestCache.current.clear();
    }
  }

  function selectHotel(candidate: HotelCandidate) {
    setHotel({
      ...candidate,
      location:
        candidate.location ||
        [candidate.city, candidate.country].filter(Boolean).join(", ") ||
        destination?.label ||
        null,
    });
    setHotelQuery(candidate.name);
    setOpenMenu("none");
    setSuggestError("");
  }

  async function browseDestination() {
    if (!destination) return;
    suggestAbort.current?.abort();
    const controller = new AbortController();
    suggestAbort.current = controller;
    setSuggestLoading(true);
    setSuggestError("");
    setHotel(null);
    try {
      const params = new URLSearchParams({
        q: "hotels",
        browse: "1",
        limit: "6",
        destination: destination.label,
        city: destination.city,
        country: destination.country,
        countryCode: destination.countryCode,
      });
      const response = await fetch(`/api/hotels/suggest?${params}`, {
        signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not browse hotels");
      const results = data.results || [];
      setHotelSuggestions(results);
      setOpenMenu("hotel");
      setHotelHighlight(0);
      if (!results.length) {
        setSuggestError(
          `No reliable property pages found for ${destination.city}. Try a hotel name.`,
        );
      }
    } catch (error: any) {
      if (error?.name === "AbortError") return;
      setSuggestError(error instanceof Error ? error.message : "Browse failed");
    } finally {
      setSuggestLoading(false);
    }
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
          destination: destination?.label,
          destinationCity: destination?.city,
          destinationCountry: destination?.country,
          destinationCountryCode: destination?.countryCode,
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
    if (!markets.length || !selectedProviders.length) {
      setSubmitError("Select at least one market and provider.");
      return;
    }
    if (jobPreview.executable < 1) {
      setSubmitError("No executable investigation jobs with this selection.");
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

  function onHotelKeyDown(e: ReactKeyboardEvent<HTMLInputElement>) {
    if (openMenu !== "hotel" || !hotelSuggestions.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHotelHighlight((i) => (i + 1) % hotelSuggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHotelHighlight((i) => (i - 1 + hotelSuggestions.length) % hotelSuggestions.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const pick = hotelSuggestions[hotelHighlight];
      if (pick) selectHotel(pick);
    }
  }

  function onDestKeyDown(e: ReactKeyboardEvent<HTMLInputElement>) {
    if (openMenu !== "destination" || !destinationOptions.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setDestHighlight((i) => (i + 1) % destinationOptions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setDestHighlight((i) => (i - 1 + destinationOptions.length) % destinationOptions.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const pick = destinationOptions[destHighlight];
      if (pick) selectDestination(pick);
    }
  }

  return (
    <div ref={rootRef} className="relative min-h-[70vh] bg-pp-bg">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(ellipse_at_top,_rgba(70,137,255,0.10),_transparent_60%)]" />
      <Container className="relative py-10 sm:py-14">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-3xl font-semibold tracking-tight text-pp-text sm:text-[2.5rem] sm:leading-tight">
            Where do you want to stay?
          </h1>
          <p className="mt-3 max-w-2xl text-base text-pp-muted sm:text-lg">
            Find your hotel. We&apos;ll compare real prices across providers and markets.
          </p>
        </div>

        <ol className="mx-auto mt-8 flex max-w-3xl gap-2 text-xs sm:text-sm">
          {["Find stay", "Your details", "Compare markets"].map((label, i) => (
            <li
              key={label}
              className={`rounded-full px-3 py-1.5 ${
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
          <section className="mx-auto mt-8 max-w-3xl">
            <div className="overflow-visible rounded-[28px] border border-pp-border bg-pp-white p-5 shadow-pp-soft sm:p-7">
              {/* Destination */}
              <label className="block text-sm font-medium text-pp-text">
                Destination
                <div className="relative mt-2">
                  <input
                    value={destinationQuery}
                    onChange={(e) => {
                      setDestinationQuery(e.target.value);
                      setDestination(null);
                      setOpenMenu("destination");
                      setDestHighlight(0);
                    }}
                    onFocus={() => setOpenMenu("destination")}
                    onKeyDown={onDestKeyDown}
                    placeholder="Where are you going?"
                    className={fieldClass}
                    autoComplete="off"
                    aria-controls="destination-listbox"
                  />
                  {openMenu === "destination" ? (
                    <ul
                      id="destination-listbox"
                      role="listbox"
                      className="absolute left-0 right-0 z-30 mt-2 max-h-64 overflow-auto rounded-2xl border border-pp-border bg-pp-white py-1 shadow-pp-soft"
                    >
                      {destinationOptions.length === 0 ? (
                        <li className="px-4 py-3 text-sm text-pp-muted">
                          No destinations match. Try another city.
                        </li>
                      ) : (
                        destinationOptions.map((option, index) => (
                          <li key={option.id} role="option" aria-selected={index === destHighlight}>
                            <button
                              type="button"
                              className={`flex w-full items-center gap-3 px-4 py-2.5 text-left ${
                                index === destHighlight
                                  ? "bg-pp-bg-secondary"
                                  : "hover:bg-pp-bg-secondary"
                              }`}
                              onMouseEnter={() => setDestHighlight(index)}
                              onClick={() => selectDestination(option)}
                            >
                              <span className="text-lg">{option.flag}</span>
                              <span>
                                <span className="block text-sm font-medium text-pp-text">
                                  {option.city}
                                </span>
                                <span className="block text-xs text-pp-muted">
                                  {option.country}
                                </span>
                              </span>
                            </button>
                          </li>
                        ))
                      )}
                    </ul>
                  ) : null}
                </div>
              </label>

              {!destination ? (
                <div className="mt-4">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-pp-muted">
                    Popular destinations
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {POPULAR_DESTINATIONS.map((d) => (
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
                  <p className="mt-2 text-xs text-pp-muted">
                    Shortcuts for common trips — not a complete world city list.
                  </p>
                </div>
              ) : (
                <p className="mt-3 text-sm text-pp-muted">
                  Searching in {destination.flag}{" "}
                  <span className="font-medium text-pp-text">{destination.label}</span>
                </p>
              )}

              {/* Hotel */}
              <label className="mt-6 block text-sm font-medium text-pp-text">
                Hotel
                <div className="relative mt-2">
                  <input
                    value={hotelQuery}
                    disabled={!destination}
                    onChange={(e) => {
                      const value = e.target.value;
                      setHotel(null);
                      setHotelQuery(value);
                      if (value.trim().length < 3) {
                        setHotelSuggestions([]);
                        setSuggestError("");
                        setSuggestLoading(false);
                        setOpenMenu(destination ? "none" : openMenu);
                      } else {
                        setOpenMenu("hotel");
                      }
                    }}
                    onFocus={() => {
                      if (hotelSuggestions.length) setOpenMenu("hotel");
                    }}
                    onKeyDown={onHotelKeyDown}
                    placeholder={
                      destination
                        ? `Search hotels in ${destination.city}…`
                        : "Select a destination first"
                    }
                    className={`${fieldClass} disabled:cursor-not-allowed disabled:opacity-60`}
                    autoComplete="off"
                    aria-controls="hotel-listbox"
                  />
                  {suggestLoading ? (
                    <p className="mt-2 text-xs text-pp-muted">
                      Finding properties in {destination?.city}…
                    </p>
                  ) : null}
                  {openMenu === "hotel" &&
                  (hotelSuggestions.length > 0 || suggestError) ? (
                    <ul
                      id="hotel-listbox"
                      role="listbox"
                      className="absolute left-0 right-0 z-30 mt-2 max-h-72 overflow-auto rounded-2xl border border-pp-border bg-pp-white py-1 shadow-pp-soft"
                    >
                      {suggestError && hotelSuggestions.length === 0 ? (
                        <li className="px-4 py-3 text-sm text-pp-muted">
                          {suggestError}
                        </li>
                      ) : (
                        hotelSuggestions.map((candidate, index) => (
                          <li
                            key={candidate.id}
                            role="option"
                            aria-selected={index === hotelHighlight}
                          >
                            <button
                              type="button"
                              className={`w-full px-4 py-3 text-left ${
                                index === hotelHighlight
                                  ? "bg-pp-bg-secondary"
                                  : "hover:bg-pp-bg-secondary"
                              }`}
                              onMouseEnter={() => setHotelHighlight(index)}
                              onClick={() => selectHotel(candidate)}
                            >
                              <span className="block text-sm font-medium text-pp-text">
                                {candidate.name}
                              </span>
                              <span className="mt-1 block text-xs text-pp-muted">
                                {[candidate.city || candidate.location, candidate.country]
                                  .filter(Boolean)
                                  .join(" · ") || destination?.label}
                              </span>
                              <span className="mt-1 block text-[11px] text-pp-muted">
                                {sourceLabel(candidate)}
                                {candidate.address ? ` · ${candidate.address}` : ""}
                              </span>
                            </button>
                          </li>
                        ))
                      )}
                    </ul>
                  ) : null}
                </div>
              </label>

              {destination && !hotel ? (
                <div className="mt-3">
                  <button
                    type="button"
                    className="text-sm text-pp-accent hover:underline"
                    onClick={() => browseDestination()}
                  >
                    {suggestLoading && openMenu === "hotel"
                      ? "Looking up properties…"
                      : `Browse hotels in ${destination.city}`}
                  </button>
                  <p className="mt-1 text-xs text-pp-muted">
                    Uses live search. Nothing is shown unless a real property page is found.
                  </p>
                </div>
              ) : null}

              <div className="mt-4">
                <button
                  type="button"
                  className="text-sm text-pp-accent hover:underline"
                  onClick={() => setShowUrlPanel((v) => !v)}
                >
                  {showUrlPanel
                    ? "Hide booking link"
                    : "Already found a hotel? Use its booking link."}
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
                <div className="mt-6 rounded-2xl border border-pp-border bg-pp-bg px-4 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.14em] text-pp-muted">
                        Selected property
                      </p>
                      <p className="mt-1 font-semibold text-pp-text">{hotel.name}</p>
                      <p className="mt-1 text-sm text-pp-muted">
                        {hotel.location || destination?.label}
                      </p>
                      <p className="mt-2 text-xs text-pp-muted">
                        Discovery candidate — identity verified during investigation
                      </p>
                    </div>
                    <button
                      type="button"
                      className="text-sm text-pp-accent hover:underline"
                      onClick={() => {
                        setHotel(null);
                        setHotelQuery("");
                        setHotelSuggestions([]);
                      }}
                    >
                      Change
                    </button>
                  </div>
                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
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
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <Stepper label="Adults" value={adults} min={1} onChange={setAdults} />
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
                  <p className="mt-4 text-sm text-pp-muted">
                    Comparing 2 providers across 2 market perspectives. You can widen
                    this after the first prices arrive.
                  </p>
                  {formError ? (
                    <p className="mt-2 text-sm text-pp-coral">{formError}</p>
                  ) : null}
                  {submitError ? (
                    <p className="mt-2 text-sm text-pp-coral">{submitError}</p>
                  ) : null}
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Button
                      type="button"
                      onClick={startInvestigation}
                      disabled={submitting || Boolean(formError)}
                    >
                      {submitting ? "Starting…" : "Compare prices"}
                    </Button>
                    <Button type="button" variant="secondary" onClick={() => setStep(3)}>
                      Adjust comparison
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        {step === 2 ? (
          <section className="mx-auto mt-8 max-w-3xl">
            <div className="rounded-[28px] border border-pp-border bg-pp-white p-5 shadow-pp-soft sm:p-7">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-pp-muted">
                    Stay
                  </p>
                  <p className="mt-1 text-lg font-semibold text-pp-text">{hotel?.name}</p>
                  <p className="text-sm text-pp-muted">
                    {hotel?.location || destination?.label}
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

              <p className="mt-5 rounded-2xl bg-pp-bg px-4 py-3 text-sm text-pp-text">
                {staySummary}
              </p>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
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

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <Stepper label="Adults" value={adults} min={1} onChange={setAdults} />
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
                    Suggested from browser locale — not proof of residence.
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
                  disabled={Boolean(formError)}
                  onClick={() => !formError && setStep(3)}
                >
                  Continue to Market Lens
                </Button>
              </div>
            </div>
          </section>
        ) : null}

        {step === 3 ? (
          <section className="mx-auto mt-8 max-w-3xl space-y-5">
            <div className="rounded-[28px] border border-pp-border bg-pp-white p-5 shadow-pp-soft sm:p-7">
              <h2 className="text-lg font-semibold text-pp-text">Market Lens</h2>
              <p className="mt-1 text-sm text-pp-muted">
                Recommended markets from your live configuration. Proxy = documented
                TinyFish country. Storefront = regional site only — not a local IP.
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <ChipButton
                  onClick={() => {
                    setMarketsTouched(false);
                    applyMarketDefaults(homeCountry, destination, true);
                  }}
                >
                  Recommended
                </ChipButton>
                <ChipButton
                  onClick={() => {
                    setMarketsTouched(true);
                    setMarkets(
                      INVESTIGATION_MARKETS.filter((m) => m.proxySupported).map(
                        (m) => m.code,
                      ),
                    );
                  }}
                >
                  All proxy markets
                </ChipButton>
                <ChipButton
                  onClick={() => {
                    setMarketsTouched(true);
                    setMarkets([]);
                  }}
                >
                  Clear
                </ChipButton>
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
                    ? "Proxy"
                    : market.storefrontAvailable
                      ? "Storefront"
                      : "Unsupported";
                  return (
                    <label
                      key={market.code}
                      className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 ${
                        selected
                          ? "border-pp-accent/35 bg-pp-bg"
                          : "border-pp-border"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={selected}
                        onChange={() => toggleMarket(market.code)}
                      />
                      <span className="flex-1">
                        <span className="flex flex-wrap items-center gap-2 text-sm font-medium text-pp-text">
                          <span>{countryFlag(market.code)}</span>
                          <span>{market.name}</span>
                          <span className="rounded-full bg-pp-bg-secondary px-2 py-0.5 text-[11px] text-pp-muted">
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
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) =>
                              setMarketAccess((prev) => ({
                                ...prev,
                                [market.code]: e.target.value,
                              }))
                            }
                          >
                            <option value="proxy">Use TinyFish proxy</option>
                            <option value="storefront">Regional storefront only</option>
                          </select>
                        ) : null}
                      </span>
                    </label>
                  );
                })}
              </div>

              {marketReason.length ? (
                <ul className="mt-4 space-y-1 text-xs text-pp-muted">
                  {marketReason.map((r) => (
                    <li key={r}>• {r}</li>
                  ))}
                </ul>
              ) : null}
            </div>

            <div className="rounded-[28px] border border-pp-border bg-pp-white p-5 shadow-pp-soft sm:p-7">
              <h2 className="text-lg font-semibold text-pp-text">Providers</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {providers.map((provider) => (
                  <label
                    key={provider.id}
                    className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${
                      selectedProviders.includes(provider.id)
                        ? "border-pp-accent/35 bg-pp-bg"
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

            <div className="rounded-[28px] border border-pp-border bg-pp-bg p-5 sm:p-6">
              <p className="text-[11px] uppercase tracking-[0.14em] text-pp-muted">
                Investigation preview
              </p>
              <p className="mt-2 text-base font-medium text-pp-text">
                Compare {hotel?.name} across {markets.length} markets and{" "}
                {selectedProviders.length} providers.
              </p>
              <p className="mt-2 text-sm text-pp-muted">
                {jobPreview.executable} executable TinyFish job
                {jobPreview.executable === 1 ? "" : "s"}
                {jobPreview.unsupported
                  ? ` · ${jobPreview.unsupported} unsupported`
                  : ""}
              </p>
              <p className="mt-1 text-sm text-pp-muted">
                {staySummary} · {countryFlag(homeCountry)} {homeCountry} ·{" "}
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
                  ? "Starting…"
                  : `Start ${jobPreview.executable} investigation${jobPreview.executable === 1 ? "" : "s"}`}
              </Button>
            </div>
          </section>
        ) : null}
      </Container>
    </div>
  );
}

function sourceLabel(candidate: HotelCandidate) {
  if (candidate.sourceClass === "ota_property") {
    return candidate.sourceDomain || "Booking provider page";
  }
  if (candidate.sourceClass === "official_property") {
    return candidate.sourceDomain || "Property page";
  }
  return candidate.sourceDomain || "Search result";
}

function ChipButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border border-pp-border px-3 py-1.5 text-xs text-pp-text hover:border-pp-accent/40"
    >
      {children}
    </button>
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
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-pp-muted">
        {label}
      </p>
      <div className="mt-2 flex items-center justify-between">
        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-pp-border bg-pp-white text-lg"
          onClick={() => onChange(Math.max(min, value - 1))}
          aria-label={`Decrease ${label}`}
        >
          −
        </button>
        <span className="text-lg font-semibold text-pp-text">{value}</span>
        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-pp-border bg-pp-white text-lg"
          onClick={() => onChange(value + 1)}
          aria-label={`Increase ${label}`}
        >
          +
        </button>
      </div>
    </div>
  );
}
