import { PROVIDERS } from "@/lib/constants";

export default function ProviderSelector({ providers = PROVIDERS }) {
  return (
    <div className="rounded-[24px] border border-pp-border bg-pp-white p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-pp-muted">
        Providers
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {providers.map((provider) => (
          <span
            key={provider.id}
            className="rounded-xl border border-pp-border bg-pp-bg px-3 py-2 text-sm font-medium text-pp-text"
          >
            {provider.name}
          </span>
        ))}
      </div>
    </div>
  );
}
