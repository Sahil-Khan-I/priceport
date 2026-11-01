import Badge from "@/components/ui/Badge";

export default function InvestigationHeader({
  title = "Investigation Room",
  subtitle = "Watch autonomous agents investigate providers and markets.",
  preview = true,
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
      {preview ? (
        <Badge tone="dark">Preview surface · live runs in Phase 02</Badge>
      ) : null}
    </div>
  );
}
