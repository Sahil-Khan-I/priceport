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

      {/* A. Decision summary */}
      <section className="mt-10 rounded-[24px] border border-pp-border bg-pp-white p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-pp-muted">
          Decision summary
        </p>
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
        <div className="mt-4 overflow-x-auto rounded-[24px] border border-pp-border bg-pp-white">
          <table className="min-w-[1100px] w-full border-collapse text-left text-sm">
            <thead className="bg-pp-bg-secondary text-pp-muted">
              <tr>
                {[
                  "Provider",
                  "Market",
                  "Original",
                  "Converted",
                  "Total",
                  "Room",
                  "Meal",
                  "Cancel",
                  "Match",
                  "Eligibility",
                  "Verify",
                  "Risk",
                  "Source",
                ].map((h) => (
                  <th key={h} className="px-3 py-3 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.offers.length === 0 ? (
                <tr>
                  <td colSpan={13} className="px-4 py-8 text-pp-muted">
                    No verified offers yet. Investigation failed or still running —
                    no fabricated prices are shown.
                  </td>
                </tr>
              ) : (
                data.offers.map((offer: any) => (
                  <tr
                    key={offer.id}
                    className={`cursor-pointer border-t border-pp-border align-top ${
                      selectedOfferId === offer.id ? "bg-pp-bg-secondary/60" : ""
                    }`}
                    onClick={() => setSelectedOfferId(offer.id)}
                  >
                    <td className="px-3 py-3 font-medium text-pp-text">
                      {offer.provider}
                      <div className="text-[11px] text-pp-muted">
                        {formatAccessLabel(offer)}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-pp-muted">{offer.market}</td>
                    <td className="px-3 py-3 text-pp-text">
                      {offer.totalPrice != null
                        ? formatMoney(offer.totalPrice, offer.currency || currency)
                        : "—"}
                      <div className="text-[11px] text-pp-muted">
                        {offer.currency || "currency unknown"}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-pp-text">
                      {offer.conversion?.available
                        ? formatMoney(offer.conversion.amount, currency)
                        : "Unavailable"}
                      <div className="text-[11px] text-pp-muted">
                        {offer.conversion?.available
                          ? `${offer.conversion.source}${
                              offer.conversion.rate != null
                                ? ` · rate ${offer.conversion.rate}`
                                : ""
                            }`
                          : offer.conversion?.reason || "No FX"}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-pp-muted">{offer.totalStatus}</td>
                    <td className="px-3 py-3 text-pp-muted">
                      {offer.roomType || "—"}
                      <div className="text-[11px]">{offer.roomMatch}</div>
                    </td>
                    <td className="px-3 py-3 text-pp-muted">
                      {offer.mealPlan || "—"}
                      <div className="text-[11px]">{offer.mealPlanStatus}</div>
                    </td>
                    <td className="px-3 py-3 text-pp-muted">
                      {offer.cancellationPolicy || "—"}
                      <div className="text-[11px]">{offer.cancellationStatus}</div>
                    </td>
                    <td className="px-3 py-3 text-pp-muted">{offer.propertyMatch}</td>
                    <td className="px-3 py-3 text-pp-muted">
                      {offer.eligibilityAssessment?.status || "not_checked"}
                    </td>
                    <td className="px-3 py-3 text-pp-muted">
                      {offer.verificationStatus || "unknown"}
                    </td>
                    <td className="px-3 py-3 text-pp-muted">
                      {offer.bookingRisk?.level || "unknown"}
                    </td>
                    <td className="px-3 py-3">
                      {offer.sourceUrl ? (
                        <a
                          href={offer.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-pp-accent hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Open
                        </a>
                      ) : (
                        "—"
                      )}
                      <div className="mt-1 font-mono text-[10px] text-pp-muted">
                        {offer.tinyfishRunId || "no run id"}
                      </div>
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
