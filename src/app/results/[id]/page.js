import { Suspense } from "react";
import ResultsView from "@/components/results/ResultsView";

export const instant = false;

export const metadata = {
  title: "Results — Priceport",
  description: "Evidence-backed hotel price comparison from TinyFish investigations.",
};

export default async function ResultsPage({ params }) {
  const { id } = await params;
  return (
    <Suspense fallback={<div className="p-10 text-pp-muted">Loading results…</div>}>
      <ResultsView investigationId={id} />
    </Suspense>
  );
}
