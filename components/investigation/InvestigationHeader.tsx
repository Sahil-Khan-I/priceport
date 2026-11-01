import Badge from "@/components/ui/Badge";

export default function InvestigationHeader({
  title = "Investigation Room",
  subtitle = "Watch TinyFish agents investigate providers and markets in real time.",
  live = true,
}: {
  title?: string;
  subtitle?: string;
  live?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-white/45">
          Priceport
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          {title}
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-white/60">{subtitle}</p>
      </div>
      {live ? <Badge tone="dark">Live TinyFish investigation</Badge> : null}
    </div>
  );
}
