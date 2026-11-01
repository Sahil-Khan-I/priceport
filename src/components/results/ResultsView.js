"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Container from "@/components/ui/Container";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { formatMoney } from "@/lib/pricing/currency";

export default function ResultsView({ investigationId }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch(`/api/results/${investigationId}`);
        const json = await response.json();
        if (!response.ok) throw new Error(json.error || "Failed to load results");
        if (!cancelled) setData(json);
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
  }, [investigationId]);

  if (error) {
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

  return (
    <Container className="py-12 sm:py-16">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Badge tone="accent">Market Lens results</Badge>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-pp-text">
            {req.hotel?.name}
          </h1>
          <p className="mt-2 text-sm text-pp-muted">
            {[req.hotel?.location, req.bookingDetails?.checkIn, req.bookingDetails?.checkOut]
              .filter(Boolean)
              .join(" · ")}{" "}
            · {req.bookingDetails?.adults} adults · {req.bookingDetails?.rooms}{" "}
            room(s) · compare in {currency}
          </p>
        </div>
        <Button href={`/investigate/${data.id}`} variant="secondary">
          Investigation Room
        </Button>
      </div>

      <div className="mt-8 grid gap-3 sm:grid-cols-4">
        <Stat label="Jobs" value={data.summary?.total || 0} />
        <Stat label="Successful" value={data.summary?.completed || 0} />
        <Stat label="Failed" value={data.summary?.failed || 0} />
        <Stat label="Unsupported" value={data.summary?.unsupported || 0} />
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <Winner
          title="Lowest comparable price found"
          offer={data.lowestComparable}
          currency={currency}
          empty="No fully comparable offer yet. Confirmed totals with property match are required."
        />
        <Winner
          title="Cheapest realistically bookable"
          offer={data.cheapestBookable}
          currency={currency}
          empty="No bookable confirmed offer yet. Eligibility and confirmed totals are required."
        />
      </div>

      <div className="mt-10 overflow-x-auto rounded-[24px] border border-pp-border bg-pp-white">
        <table className="min-w-[960px] w-full border-collapse text-left text-sm">
          <thead className="bg-pp-bg-secondary text-pp-muted">
            <tr>
              {[
                "Provider",
                "Market",
                "Original",
                "Converted",
                "Total status",
                "Room",
                "Meal",
                "Cancel",
                "Match",
                "Eligibility",
                "Source",
              ].map((h) => (
                <th key={h} className="px-4 py-3 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.offers.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-4 py-8 text-pp-muted">
                  No verified offers yet. Investigation failed or still running —
                  no fabricated prices are shown.
                </td>
              </tr>
            ) : (
              data.offers.map((offer) => (
                <tr key={offer.id} className="border-t border-pp-border align-top">
                  <td className="px-4 py-3 font-medium text-pp-text">
                    {offer.provider}
                    <div className="text-[11px] text-pp-muted">
                      {offer.accessMethod}
                      {offer.actualProxyCountry
                        ? ` · proxy ${offer.actualProxyCountry}`
                        : ""}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-pp-muted">{offer.market}</td>
                  <td className="px-4 py-3 text-pp-text">
                    {offer.totalPrice != null
                      ? formatMoney(offer.totalPrice, offer.currency || currency)
                      : "—"}
                    <div className="text-[11px] text-pp-muted">
                      {offer.currency || "currency unknown"}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-pp-text">
                    {offer.conversion?.available
                      ? formatMoney(offer.conversion.amount, currency)
                      : "Unavailable"}
                    <div className="text-[11px] text-pp-muted">
                      {offer.conversion?.available
                        ? `${offer.conversion.source}`
                        : offer.conversion?.reason || "No FX"}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-pp-muted">{offer.totalStatus}</td>
                  <td className="px-4 py-3 text-pp-muted">{offer.roomType || "—"}</td>
                  <td className="px-4 py-3 text-pp-muted">{offer.mealPlan || "—"}</td>
                  <td className="px-4 py-3 text-pp-muted">
                    {offer.cancellationPolicy || "—"}
                  </td>
                  <td className="px-4 py-3 text-pp-muted">{offer.propertyMatch}</td>
                  <td className="px-4 py-3 text-pp-muted">
                    {offer.eligibility?.length
                      ? offer.eligibility.join("; ")
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {offer.sourceUrl ? (
                      <a
                        href={offer.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-pp-accent hover:underline"
                      >
                        Open source
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

      {data.jobs?.some((j) => j.error) ? (
        <div className="mt-8 rounded-[24px] border border-pp-border bg-pp-bg-secondary p-5">
          <h2 className="text-sm font-semibold text-pp-text">Job notes</h2>
          <ul className="mt-3 space-y-2 text-sm text-pp-muted">
            {data.jobs
              .filter((j) => j.error)
              .map((j) => (
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
      </p>
    </Container>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-2xl border border-pp-border bg-pp-white p-4">
      <p className="text-xs uppercase tracking-[0.14em] text-pp-muted">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-pp-text">{value}</p>
    </div>
  );
}

function Winner({ title, offer, currency, empty }) {
  return (
    <div className="rounded-[24px] border border-pp-border bg-pp-white p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-pp-muted">
        {title}
      </p>
      {offer ? (
        <>
          <p className="mt-3 text-2xl font-semibold text-pp-text">
            {offer.conversion?.available
              ? formatMoney(offer.conversion.amount, currency)
              : formatMoney(offer.totalPrice, offer.currency || currency)}
          </p>
          <p className="mt-1 text-sm text-pp-muted">
            {offer.provider} · {offer.market} · match {offer.propertyMatch}
          </p>
          {offer.sourceUrl ? (
            <a
              href={offer.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block text-sm text-pp-accent hover:underline"
            >
              Open booking source
            </a>
          ) : null}
        </>
      ) : (
        <p className="mt-3 text-sm text-pp-muted">{empty}</p>
      )}
    </div>
  );
}
