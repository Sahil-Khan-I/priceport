"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Container from "@/components/ui/Container";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { formatMoney } from "@/lib/pricing/currency";

export default function ResultsView({
  investigationId,
}: {
  investigationId: string;
}) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [trackBusy, setTrackBusy] = useState(false);
  const [alts, setAlts] = useState<any[] | null>(null);
  const [altsError, setAltsError] = useState("");
  const [altsBusy, setAltsBusy] = useState(false);
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch(`/api/results/${investigationId}`);
        const json = await response.json();
        if (!response.ok) throw new Error(json.error || "Failed to load results");
        if (!cancelled) {
          setData(json);
          if (!selectedOfferId && json.bestVerified?.id) {
            setSelectedOfferId(json.bestVerified.id);
          } else if (!selectedOfferId && json.offers?.[0]?.id) {
            setSelectedOfferId(json.offers[0].id);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load results");
        }
      }
    }
    load();
    const timer = setInterval(load, 5000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [investigationId]);

  async function trackSearch() {
    setTrackBusy(true);
    try {
      const response = await fetch("/api/tracks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ investigationId }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Could not track search");
      setData((prev: any) =>
        prev
          ? {
              ...prev,
              track: {
                id: json.track.id,
                label: json.track.label,
                monitoringMode: json.track.monitoringMode,
                note: json.track.note,
                lastCheckedAt: json.track.lastCheckedAt,
              },
            }
          : prev,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not track search");
    } finally {
      setTrackBusy(false);
    }
  }

  async function loadAlternatives() {
    setAltsBusy(true);
    setAltsError("");
    try {
      const response = await fetch("/api/alternatives", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ investigationId }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Discovery failed");
      setAlts(json.alternatives || []);
    } catch (err) {
      setAltsError(
        err instanceof Error ? err.message : "Alternative discovery failed",
      );
    } finally {
      setAltsBusy(false);
    }
  }

  if (error && !data) {
    return (
      <Container className="py-16">
        <p className="text-pp-coral">{error}</p>
      </Container>
    );
  }

  if (!data) {
    return (
      <Container className="py-16">
        <p className="text-pp-muted">Loading results…</p>
      </Container>
    );
  }

  const req = data.request;
  const currency = req.preferredCurrency || "USD";
  const decision = data.decision || {};
  const selected =
    data.offers?.find((o: any) => o.id === selectedOfferId) ||
    data.bestVerified ||
    data.offers?.[0] ||
    null;
  const selectedIntel =
    data.priceIntelligence?.find((p: any) => p.offerId === selected?.id) ||
    null;

  return (
    <Container className="py-12 sm:py-16">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Badge tone="accent">Purchase intelligence</Badge>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-pp-text">
            {req.hotel?.name}
          </h1>
          <p className="mt-2 text-sm text-pp-muted">
            {[req.hotel?.location, req.bookingDetails?.checkIn, "→", req.bookingDetails?.checkOut]
              .filter(Boolean)
              .join(" ")}{" "}
            · {req.bookingDetails?.adults} adults · {req.bookingDetails?.rooms}{" "}
            room(s) · home {req.homeCountry || "—"} · compare in {currency}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button href={`/investigate/${data.id}`} variant="secondary">
            Investigation Room
          </Button>
          {data.track ? (
            <Button href={`/tracks/${data.track.id}`} variant="secondary">
              Open track
            </Button>
          ) : (
            <Button onClick={trackSearch} disabled={trackBusy} variant="secondary">
              {trackBusy ? "Saving…" : "Track this search"}
            </Button>
          )}
        </div>
      </div>

      <SavingsSummaryCard
        savings={data.savings}
        currency={currency}
        nights={data.nights}
      />

      {/* A. Decision summary */}
      <section className="mt-6 rounded-2xl border border-pp-border bg-pp-white p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-pp-muted">
          Recommendation
        </p>
        {data.bestVerified?.conversion?.available ? (
          <p className="mt-3 text-3xl font-semibold tracking-tight text-pp-text">
            {formatMoney(data.bestVerified.conversion.amount, currency)}
          </p>
        ) : null}
        <p className="mt-3 max-w-3xl text-base leading-relaxed text-pp-text">
          {decision.summary ||
            "Waiting for verified offers. No fabricated prices are shown."}
        </p>
        {decision.mainRisks?.length ? (
          <ul className="mt-4 space-y-1.5 text-sm text-pp-muted">
            {decision.mainRisks.map((risk: string) => (
              <li key={risk}>• {risk}</li>
            ))}
          </ul>
        ) : null}
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Winner
            title="Best verified"
            offer={data.bestVerified}
            currency={currency}
            empty="No evidence-backed verified offer yet."
          />
          <Winner
            title="Lowest comparable"
            offer={data.lowestComparable}
            currency={currency}
            empty="No fully comparable confirmed total yet."
          />
          <Winner
            title="Lowest displayed"
            offer={data.lowestDisplayed}
            currency={currency}
            empty="No converted displayed totals yet."
          />
          <Winner
            title="Cheapest bookable"
            offer={data.cheapestBookable}
            currency={currency}
            empty="No bookable confirmed offer yet."
          />
        </div>
        {decision.estimatedSavings ? (
          <p className="mt-4 text-sm text-pp-muted">
            Savings context: {formatMoney(decision.estimatedSavings.amount, currency)} —{" "}
            {decision.estimatedSavings.note}
          </p>
        ) : null}
      </section>

      <div className="mt-8 grid gap-3 sm:grid-cols-4">
        <Stat label="Jobs" value={data.summary?.total || 0} />
        <Stat label="Successful" value={data.summary?.completed || 0} />
        <Stat label="Failed" value={data.summary?.failed || 0} />
        <Stat label="Unsupported" value={data.summary?.unsupported || 0} />
      </div>

      {/* B. Market Lens comparison */}
      <section className="mt-10">
        <h2 className="text-lg font-semibold text-pp-text">Market Lens</h2>
        <p className="mt-1 text-sm text-pp-muted">
          Provider × market offers from live TinyFish jobs. Access method is labeled
          honestly: Proxy = documented local IP; Storefront = regional site only.
          Missing fields stay unknown — never invented.
        </p>
        <ul className="mt-4 grid gap-3 lg:grid-cols-2">
          {data.offers.length === 0 ? (
            <li className="rounded-2xl border border-pp-border bg-white px-4 py-6 text-sm text-pp-muted lg:col-span-2">
              No usable offers yet. Failed or incomplete checks stay visible in the live research view.
            </li>
          ) : (
            data.offers.map((offer: any) => (
              <li key={`card-${offer.id}`}>
                <OfferCard
                  offer={offer}
                  currency={currency}
                  selected={selectedOfferId === offer.id}
                  tags={offerTags(offer, data)}
                  onSelect={() => setSelectedOfferId(offer.id)}
                />
              </li>
            ))
          )}
        </ul>
        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.14em] text-pp-muted md:hidden">
          Detailed comparison is available on larger screens
        </p>
        <p className="mt-6 hidden text-xs font-semibold uppercase tracking-[0.14em] text-pp-muted md:block">
          Detailed comparison
        </p>
        <div className="mt-4 hidden overflow-x-auto rounded-2xl border border-pp-border bg-white md:block">
          <table className="min-w-[900px] w-full border-collapse text-left text-sm">
            <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-[0.08em] text-pp-muted">
              <tr>
                {["Booking site", "Price comparison", "Room & board", "Cancellation", "Total confidence", "Booking checks", "Source"].map((heading) => (
                  <th key={heading} className="px-4 py-3">{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.offers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-pp-muted">
                    No usable offers yet. Incomplete and failed checks remain visible in the investigation room.
                  </td>
                </tr>
              ) : (
                data.offers.map((offer: any) => (
                  <tr
                    key={offer.id}
                    className={`cursor-pointer border-t border-pp-border align-top transition-colors hover:bg-slate-50 ${selectedOfferId === offer.id ? "bg-blue-50/60" : "bg-white"}`}
                    onClick={() => setSelectedOfferId(offer.id)}
                    aria-selected={selectedOfferId === offer.id}
                  >
                    <td className="px-4 py-4">
                      <p className="font-semibold text-pp-text">{offer.provider}</p>
                      <p className="mt-1 text-xs text-pp-muted">{offer.market} · {formatAccessLabel(offer)}</p>
                      {offer.availability ? <p className="mt-2 text-[11px] text-pp-muted">Availability: {offer.availability}</p> : null}
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-base font-semibold tabular-nums text-pp-text">
                        {offer.totalPrice != null ? formatMoney(offer.totalPrice, offer.currency || currency) : "Price unavailable"}
                      </p>
                      <p className="mt-1 text-[11px] text-pp-muted">Provider displayed · {offer.currency || "currency unknown"}</p>
                      <div className="mt-2 border-t border-pp-border pt-2">
                        <p className="text-sm font-semibold tabular-nums text-pp-accent">
                          {offer.conversion?.available ? formatMoney(offer.conversion.amount, currency) : "Conversion unavailable"}
                        </p>
                        <p className="mt-1 max-w-48 text-[10px] leading-4 text-pp-muted">
                          {offer.conversion?.available
                            ? `Converted to ${currency} · ${offer.conversion.source || "FX source"}`
                            : offer.conversion?.reason || "No conversion evidence"}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <p className="max-w-44 font-medium text-pp-text">{offer.roomType || "Room not identified"}</p>
                      <p className="mt-1 text-xs text-pp-muted">{offer.mealPlan || "Meal plan unknown"}</p>
                      <p className="mt-1 text-[10px] text-pp-muted">Room match: {offer.roomMatch || "unknown"}</p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="max-w-40 text-xs leading-5 text-pp-text">{offer.cancellationPolicy || "Not confirmed"}</p>
                      <p className="mt-1 text-[10px] text-pp-muted">{offer.cancellationStatus || "Policy status unknown"}</p>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${offer.trueCost?.fullyComparable ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>
                        {offer.trueCost?.fullyComparable ? "All-in confirmed" : offer.totalStatus || "Incomplete"}
                      </span>
                      <p className="mt-2 max-w-40 text-[11px] leading-4 text-pp-muted">
                        {offer.trueCost?.fullyComparable
                          ? "Required fee components are present."
                          : "Some taxes or fees may still be unknown."}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-xs font-medium text-pp-text">Property: {offer.propertyMatch || "unknown"}</p>
                      <p className="mt-1 text-xs text-pp-muted">Eligibility: {offer.eligibilityAssessment?.status || "not checked"}</p>
                      <p className="mt-1 text-xs text-pp-muted">Verification: {offer.verificationStatus || "unknown"}</p>
                      <p className="mt-1 text-xs text-pp-muted">Risk: {offer.bookingRisk?.level || "unknown"}</p>
                    </td>
                    <td className="px-4 py-4">
                      {offer.sourceUrl ? (
                        <a
                          href={offer.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center rounded-lg border border-pp-border px-3 py-2 text-xs font-semibold text-pp-text transition hover:border-pp-accent hover:text-pp-accent"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Open offer ↗
                        </a>
                      ) : <span className="text-xs text-pp-muted">No source link</span>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {data.roomDiffNotes ? (
          <div className="mt-3 rounded-2xl border border-pp-border bg-pp-bg-secondary p-4 text-sm text-pp-muted">
            <p className="font-medium text-pp-text">Room / condition differences</p>
            {data.roomDiffNotes.differences?.length ? (
              <ul className="mt-2 list-disc pl-5">
                {data.roomDiffNotes.differences.map((d: string) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-2">No hard room differences detected between highlighted offers.</p>
            )}
            {data.roomDiffNotes.unknowns?.length ? (
              <p className="mt-2">Unknowns: {data.roomDiffNotes.unknowns.join("; ")}</p>
            ) : null}
          </div>
        ) : null}
      </section>

      {/* C + D + E + G detail for selected offer */}
      {selected ? (
        <div className="mt-10 grid gap-4 lg:grid-cols-2">
          <section className="rounded-[24px] border border-pp-border bg-pp-white p-5">
            <h2 className="text-lg font-semibold text-pp-text">True-cost breakdown</h2>
            <p className="mt-1 text-sm text-pp-muted">
              {selected.provider} · {selected.market}
            </p>
            <dl className="mt-4 space-y-2 text-sm">
              <Row label="Base" value={moneyOrUnknown(selected.trueCost?.basePrice ?? selected.basePrice, selected.currency)} />
              <Row label="Taxes" value={moneyOrUnknown(selected.trueCost?.taxes ?? selected.taxes, selected.currency)} />
              <Row label="Mandatory fees" value={moneyOrUnknown(selected.trueCost?.mandatoryFees ?? selected.mandatoryFees, selected.currency)} />
              <Row label="Estimated fees" value={moneyOrUnknown(selected.trueCost?.estimatedFees ?? selected.estimatedFees, selected.currency)} />
              <Row
                label="Unknown fees"
                value={
                  selected.trueCost?.unknownFees?.length
                    ? selected.trueCost.unknownFees.join("; ")
                    : "None reported"
                }
              />
              <Row
                label="Displayed total"
                value={moneyOrUnknown(selected.trueCost?.displayedTotal ?? selected.totalPrice, selected.currency)}
              />
              <Row label="Status" value={selected.trueCost?.totalStatus || selected.totalStatus} />
              <Row
                label="Converted"
                value={
                  selected.conversion?.available
                    ? `${formatMoney(selected.conversion.amount, currency)} (${selected.conversion.source}, rate ${selected.conversion.rate}, ${selected.conversion.fetchedAt || "—"})`
                    : selected.conversion?.reason || "Unavailable"
                }
              />
            </dl>
          </section>

          <section className="rounded-[24px] border border-pp-border bg-pp-white p-5">
            <h2 className="text-lg font-semibold text-pp-text">Verification report</h2>
            <dl className="mt-4 space-y-2 text-sm">
              <Row label="Property match" value={selected.propertyMatch} />
              <Row label="Room match" value={selected.roomMatch || "unknown"} />
              <Row label="Meal plan" value={`${selected.mealPlan || "—"} (${selected.mealPlanStatus || "unknown"})`} />
              <Row label="Cancellation" value={`${selected.cancellationPolicy || "—"} (${selected.cancellationStatus || "unknown"})`} />
              <Row label="Eligibility" value={selected.eligibilityAssessment?.status || "not_checked"} />
              <Row label="Verification" value={selected.verificationStatus || "unknown"} />
              <Row label="Risk" value={`${selected.bookingRisk?.level || "unknown"} — ${selected.bookingRisk?.summary || ""}`} />
              <Row
                label="Missing fields"
                value={
                  selected.missingFields?.length
                    ? selected.missingFields.join(", ")
                    : "None flagged"
                }
              />
            </dl>
            {selected.bookingRisk?.warnings?.length ? (
              <ul className="mt-4 space-y-2 text-sm text-pp-muted">
                {selected.bookingRisk.warnings.map((w: any) => (
                  <li key={w.code}>
                    <span className="font-medium text-pp-text">{w.message}</span>
                    {w.evidence ? (
                      <span className="block text-[12px]">Evidence: {w.evidence}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </section>

          <section className="rounded-[24px] border border-pp-border bg-pp-white p-5">
            <h2 className="text-lg font-semibold text-pp-text">Price intelligence</h2>
            {!selectedIntel || selectedIntel.observationCount < 1 ? (
              <p className="mt-3 text-sm text-pp-muted">
                No historical observations yet for this stay/provider/market. Tracking
                creates observations from real checks only.
              </p>
            ) : (
              <>
                <p className="mt-3 text-sm text-pp-muted">
                  {selectedIntel.observationCount} real observation
                  {selectedIntel.observationCount === 1 ? "" : "s"} stored.
                </p>
                {selectedIntel.movement?.available ? (
                  <p className="mt-2 text-sm text-pp-text">
                    {selectedIntel.movement.note} (
                    {formatMoney(selectedIntel.movement.previous, selectedIntel.movement.currency)} →{" "}
                    {formatMoney(selectedIntel.movement.current, selectedIntel.movement.currency)})
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-pp-muted">
                    {selectedIntel.movement?.reason ||
                      "Need another real observation to detect movement."}
                  </p>
                )}
              </>
            )}
            {data.track ? (
              <p className="mt-4 text-sm text-pp-muted">{data.track.note}</p>
            ) : (
              <p className="mt-4 text-sm text-pp-muted">
                Background monitoring is not configured. Track this search, then re-check
                manually.
              </p>
            )}
          </section>

          <section className="rounded-[24px] border border-pp-border bg-pp-white p-5">
            <h2 className="text-lg font-semibold text-pp-text">Evidence and sources</h2>
            {selected.sourceUrl ? (
              <a
                href={selected.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-block text-sm text-pp-accent hover:underline"
              >
                Open source URL
              </a>
            ) : (
              <p className="mt-3 text-sm text-pp-muted">No source URL captured.</p>
            )}
            <p className="mt-2 font-mono text-[11px] text-pp-muted">
              TinyFish run: {selected.tinyfishRunId || "—"} · checked{" "}
              {selected.checkedAt || "—"}
            </p>
            <ul className="mt-4 max-h-48 space-y-2 overflow-y-auto text-sm text-pp-muted">
              {(selected.evidence || []).length === 0 ? (
                <li>No evidence snippets returned.</li>
              ) : (
                selected.evidence.map((item: string, i: number) => (
                  <li key={`${i}-${item.slice(0, 24)}`}>• {item}</li>
                ))
              )}
            </ul>
          </section>
        </div>
      ) : null}

      {/* F. Alternatives */}
      <section className="mt-10 rounded-[24px] border border-pp-border bg-pp-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-pp-text">Alternative properties</h2>
            <p className="mt-1 text-sm text-pp-muted">
              Separate from the original hotel. Discovery uses TinyFish Search — not
              price-verified until investigated.
            </p>
          </div>
          <Button onClick={loadAlternatives} disabled={altsBusy} variant="secondary">
            {altsBusy ? "Searching…" : "Discover alternatives"}
          </Button>
        </div>
        {altsError ? <p className="mt-3 text-sm text-pp-coral">{altsError}</p> : null}
        {alts ? (
          alts.length === 0 ? (
            <p className="mt-4 text-sm text-pp-muted">
              No alternative candidates returned for this query.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {alts.map((alt) => (
                <li
                  key={alt.id}
                  className="rounded-2xl border border-pp-border bg-pp-bg-secondary px-4 py-3"
                >
                  <p className="font-medium text-pp-text">{alt.name}</p>
                  <p className="mt-1 text-sm text-pp-muted">{alt.snippet || alt.note}</p>
                  <a
                    href={alt.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-block text-sm text-pp-accent hover:underline"
                  >
                    Open discovery source
                  </a>
                </li>
              ))}
            </ul>
          )
        ) : null}
      </section>

      {data.jobs?.some((j: any) => j.error) ? (
        <div className="mt-8 rounded-[24px] border border-pp-border bg-pp-bg-secondary p-5">
          <h2 className="text-sm font-semibold text-pp-text">Job notes</h2>
          <ul className="mt-3 space-y-2 text-sm text-pp-muted">
            {data.jobs
              .filter((j: any) => j.error)
              .map((j: any) => (
                <li key={j.id}>
                  {j.providerName} × {j.market}: {j.error}
                </li>
              ))}
          </ul>
        </div>
      ) : null}

      <p className="mt-8 text-sm text-pp-muted">
        <Link href="/search" className="text-pp-accent hover:underline">
          New investigation
        </Link>
        {" · "}
        <Link href="/tracks" className="text-pp-accent hover:underline">
          Tracked searches
        </Link>
      </p>
    </Container>
  );
}

function offerTags(offer: any, data: any) {
  const tags: Array<{ label: string; tone: "blue" | "emerald" | "amber" | "slate" }> = [];
  if (data.bestVerified?.id === offer.id) tags.push({ label: "Best verified", tone: "emerald" });
  if (data.lowestComparable?.id === offer.id) tags.push({ label: "Lowest comparable", tone: "blue" });
  if (data.lowestDisplayed?.id === offer.id) tags.push({ label: "Lowest displayed", tone: "slate" });
  if (data.cheapestBookable?.id === offer.id) tags.push({ label: "Cheapest bookable", tone: "blue" });
  if (!offer.trueCost?.fullyComparable) tags.push({ label: "Incomplete total", tone: "amber" });
  if (!["verified", "partially_verified"].includes(String(offer.verificationStatus))) {
    tags.push({ label: "Unverified", tone: "amber" });
  }
  return tags;
}

const TAG_TONE = {
  blue: "bg-blue-50 text-blue-700",
  emerald: "bg-emerald-50 text-emerald-700",
  amber: "bg-amber-50 text-amber-800",
  slate: "bg-slate-100 text-slate-700",
} as const;

function taxesLine(offer: any) {
  const taxes = offer.taxes;
  const fees = offer.mandatoryFees;
  if (taxes == null && fees == null) return "Taxes and fees not confirmed";
  const parts: string[] = [];
  if (taxes != null) parts.push(`taxes ${formatMoney(taxes, offer.currency || "USD")}`);
  if (fees != null) parts.push(`mandatory fees ${formatMoney(fees, offer.currency || "USD")}`);
  if (taxes == null || fees == null) parts.push("rest not confirmed");
  return parts.join(" · ");
}

function OfferCard({
  offer,
  currency,
  selected,
  tags,
  onSelect,
}: {
  offer: any;
  currency: string;
  selected: boolean;
  tags: Array<{ label: string; tone: keyof typeof TAG_TONE }>;
  onSelect: () => void;
}) {
  const link = offer.bookingLink;
  const converted = offer.conversion?.available;
  return (
    <article
      className={`rounded-2xl border bg-white p-5 shadow-[0_1px_0_rgba(23,32,51,0.04),0_10px_24px_rgba(23,32,51,0.05)] transition-[border-color,box-shadow] duration-150 ${
        selected ? "border-pp-accent" : "border-pp-border hover:border-slate-300"
      }`}
    >
      <button type="button" onClick={onSelect} className="w-full text-left" aria-pressed={selected}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-pp-text">{offer.provider}</p>
            <p className="mt-0.5 text-xs text-pp-muted">
              {offer.market} · {formatAccessLabel(offer)}
            </p>
          </div>
          <div className="flex flex-wrap justify-end gap-1.5">
            {tags.slice(0, 3).map((tag) => (
              <span
                key={tag.label}
                className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${TAG_TONE[tag.tone]}`}
              >
                {tag.label}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <p className="text-3xl font-semibold tabular-nums tracking-tight text-pp-text">
            {converted ? formatMoney(offer.conversion.amount, currency) : offer.totalPrice != null ? formatMoney(offer.totalPrice, offer.currency || currency) : "Price unavailable"}
          </p>
          <p className="mt-1 text-xs text-pp-muted">
            {converted
              ? `Converted from ${offer.totalPrice != null ? formatMoney(offer.totalPrice, offer.currency || currency) : "provider price"} · ${offer.conversion.source || "FX source unavailable"}`
              : offer.conversion?.reason || "Shown in the provider currency. Conversion unavailable."}
          </p>
          {offer.perNight?.converted != null || offer.perNight?.original != null ? (
            <p className="mt-1 text-sm tabular-nums text-pp-text">
              {offer.perNight.converted != null
                ? formatMoney(offer.perNight.converted, currency)
                : formatMoney(offer.perNight.original, offer.currency || currency)}{" "}
              <span className="text-pp-muted">per night · {offer.nights} nights</span>
            </p>
          ) : null}
        </div>

        <dl className="mt-4 grid grid-cols-[88px_1fr] gap-x-3 gap-y-1.5 text-xs">
          <dt className="text-pp-muted">Room</dt>
          <dd className="text-pp-text">{offer.roomType || "Not identified"}</dd>
          <dt className="text-pp-muted">Meals</dt>
          <dd className="text-pp-text">{offer.mealPlan || "Unknown"}</dd>
          <dt className="text-pp-muted">Cancellation</dt>
          <dd className="text-pp-text">{offer.cancellationPolicy || "Not confirmed"}</dd>
          <dt className="text-pp-muted">Taxes & fees</dt>
          <dd className="text-pp-text">{taxesLine(offer)}</dd>
          <dt className="text-pp-muted">Eligibility</dt>
          <dd className="text-pp-text">{offer.eligibilityAssessment?.status || "Not checked"}</dd>
          <dt className="text-pp-muted">Checked</dt>
          <dd className="text-pp-text">
            {offer.checkedAt ? new Date(offer.checkedAt).toLocaleString() : "Unknown"}
          </dd>
        </dl>
      </button>

      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-pp-border pt-4">
        {link?.url ? (
          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center rounded-xl bg-pp-accent px-4 py-2.5 text-sm font-medium text-white shadow-[0_3px_0_0_#2f63c4] transition-[transform,box-shadow] duration-150 hover:-translate-y-px active:translate-y-[2px] active:shadow-[0_1px_0_0_#2f63c4] motion-reduce:transition-none"
          >
            {link.label} ↗
          </a>
        ) : (
          <span className="text-sm text-pp-muted">{link?.label || "No booking link available"}</span>
        )}
        {link?.note ? <span className="text-xs text-pp-muted">{link.note}</span> : null}
      </div>
    </article>
  );
}

function SavingsSummaryCard({
  savings,
  currency,
  nights,
}: {
  savings: any;
  currency: string;
  nights: number | null;
}) {
  if (!savings) return null;
  const head = savings.headline;
  return (
    <section className="mt-8 rounded-2xl border border-pp-border bg-white p-6 shadow-[0_1px_0_rgba(23,32,51,0.04),0_10px_24px_rgba(23,32,51,0.05)]">
      {head ? (
        <>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">
            Verified comparable savings
          </p>
          <p className="mt-2 text-4xl font-semibold tabular-nums tracking-tight text-pp-text">
            Save up to {formatMoney(head.savings, currency)}
          </p>
          <p className="mt-1 text-sm text-pp-muted">
            {head.percent}% below the highest comparable offer
            {nights ? ` · ${nights} nights` : ""}
          </p>
          <dl className="mt-5 grid gap-4 sm:grid-cols-3">
            <div>
              <dt className="text-xs text-pp-muted">Lowest comparable total</dt>
              <dd className="mt-1 text-lg font-semibold tabular-nums text-pp-text">{formatMoney(head.lowest, currency)}</dd>
            </div>
            <div>
              <dt className="text-xs text-pp-muted">Highest comparable total</dt>
              <dd className="mt-1 text-lg font-semibold tabular-nums text-pp-text">{formatMoney(head.highest, currency)}</dd>
            </div>
            <div>
              <dt className="text-xs text-pp-muted">Compared on</dt>
              <dd className="mt-1 text-sm text-pp-text">{head.label}</dd>
            </div>
          </dl>
        </>
      ) : (
        <>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-pp-muted">Savings</p>
          <p className="mt-2 text-lg font-semibold text-pp-text">{savings.reason}</p>
        </>
      )}
      <p className="mt-4 text-xs leading-5 text-pp-muted">
        {savings.basis}
        {savings.fxSource ? ` Converted using ${savings.fxSource}.` : ""} Prices are not guaranteed and may change before booking.
      </p>
      {savings.groups?.length > 1 ? (
        <ul className="mt-3 space-y-1 text-xs text-pp-muted">
          {savings.groups.slice(1).map((group: any) => (
            <li key={group.key}>
              {group.label}: up to {formatMoney(group.savings, currency)} ({group.percent}%)
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function formatAccessLabel(offer: {
  accessMethod?: string | null;
  actualProxyCountry?: string | null;
  storefrontRegion?: string | null;
}) {
  const method = String(offer.accessMethod || "").toLowerCase();
  if (method.includes("proxy") || offer.actualProxyCountry) {
    return `Proxy${offer.actualProxyCountry ? ` · ${offer.actualProxyCountry}` : ""}`;
  }
  if (method.includes("storefront") || offer.storefrontRegion) {
    return `Storefront${offer.storefrontRegion ? ` · ${offer.storefrontRegion}` : ""}`;
  }
  return offer.accessMethod || "Access unknown";
}

function moneyOrUnknown(amount: number | null | undefined, currency: string) {
  if (amount == null) return "Unknown";
  return formatMoney(amount, currency || "USD");
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <dt className="w-36 shrink-0 text-pp-muted">{label}</dt>
      <dd className="text-pp-text">{value}</dd>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-pp-border bg-pp-white p-4">
      <p className="text-xs uppercase tracking-[0.14em] text-pp-muted">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-pp-text">{value}</p>
    </div>
  );
}

function Winner({
  title,
  offer,
  currency,
  empty,
}: {
  title: string;
  offer: any;
  currency: string;
  empty: string;
}) {
  return (
    <div className="rounded-2xl border border-pp-border bg-pp-bg-secondary p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-pp-muted">
        {title}
      </p>
      {offer ? (
        <>
          <p className="mt-2 text-xl font-semibold text-pp-text">
            {offer.conversion?.available
              ? formatMoney(offer.conversion.amount, currency)
              : formatMoney(offer.totalPrice, offer.currency || currency)}
          </p>
          <p className="mt-1 text-xs text-pp-muted">
            {offer.provider} · {offer.market} · {offer.verificationStatus || offer.propertyMatch}
          </p>
        </>
      ) : (
        <p className="mt-2 text-xs text-pp-muted">{empty}</p>
      )}
    </div>
  );
}
