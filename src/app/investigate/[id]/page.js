import { Suspense } from "react";
import LiveInvestigationRoom from "@/components/investigation/LiveInvestigationRoom";

export const instant = false;

export const metadata = {
  title: "Investigation Room — Priceport",
  description: "Live TinyFish hotel investigation activity.",
};

export default async function InvestigatePage({ params }) {
  const { id } = await params;
  return (
    <Suspense fallback={<div className="p-10 text-pp-muted">Loading investigation…</div>}>
      <LiveInvestigationRoom investigationId={id} />
    </Suspense>
  );
}
