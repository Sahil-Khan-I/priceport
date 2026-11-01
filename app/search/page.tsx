import { Suspense } from "react";
import SearchWorkflow from "@/components/search/SearchWorkflow";

export const metadata = {
  title: "Where are you planning to stay? — Priceport",
  description:
    "Find your hotel. Priceport investigates global prices across markets and booking providers with real TinyFish agents.",
};

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="p-10 text-center text-pp-muted">Loading search…</div>
      }
    >
      <SearchWorkflow />
    </Suspense>
  );
}
