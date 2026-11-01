import Container from "@/components/ui/Container";
import SectionHeading from "@/components/ui/SectionHeading";
import Reveal from "@/components/ui/Reveal";

const steps = [
  { title: "User request", detail: "Hotel, dates, guests, markets" },
  { title: "TinyFish agents", detail: "Parallel provider investigations" },
  { title: "Live websites", detail: "Real navigation + extraction" },
  { title: "Structured findings", detail: "Prices, fees, evidence, run IDs" },
  { title: "Priceport intelligence", detail: "Match, normalize, true cost" },
  { title: "Market Lens", detail: "Actionable recommendations" },
];

const capabilities = [
  {
    name: "TinyAgent",
    role: "Primary investigation engine for interactive website work.",
  },
  {
    name: "TinySearch",
    role: "Discover providers, official sites, and regional pages.",
  },
  {
    name: "TinyFetch",
    role: "Lightweight extraction for known URLs without a full agent.",
  },
  {
    name: "TinyBrowser",
    role: "Extension point for precise CDP / Playwright control.",
  },
];

export default function TinyFishSection() {
  return (
    <section id="tinyfish" className="bg-pp-bg-secondary py-20 sm:py-24">
      <Container>
        <Reveal>
          <SectionHeading
            eyebrow="Powered by TinyFish"
            title="Agents that do the searching. Intelligence that finds the deal."
            description="TinyFish handles live website investigations. Priceport orchestrates jobs, coordinates providers and markets, matches offers, normalizes currency, calculates true cost, analyzes eligibility, and ranks recommendations."
          />
        </Reveal>

        <Reveal className="mt-12" delay={60}>
          <div className="overflow-x-auto pb-2">
            <ol className="flex min-w-[720px] items-stretch gap-3">
              {steps.map((step, index) => (
                <li
                  key={step.title}
                  className="relative flex min-w-[140px] flex-1 flex-col rounded-2xl border border-pp-border bg-pp-white p-4"
                >
                  <span className="text-[11px] font-semibold text-pp-accent">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <p className="mt-2 text-sm font-semibold text-pp-text">
                    {step.title}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-pp-muted">
                    {step.detail}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </Reveal>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {capabilities.map((item, index) => (
            <Reveal key={item.name} delay={index * 60}>
              <div className="h-full rounded-2xl border border-pp-border bg-pp-white p-5">
                <p className="text-sm font-semibold text-pp-text">{item.name}</p>
                <p className="mt-2 text-sm leading-relaxed text-pp-muted">
                  {item.role}
                </p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal className="mt-8">
          <p className="max-w-3xl text-sm text-pp-muted">
            TinyFish is not a chatbot. It is live web investigation
            infrastructure. Documented proxy countries today: US, GB, CA, DE, FR,
            JP, AU. Unsupported markets are labeled — we never invent geo access.
          </p>
        </Reveal>
      </Container>
    </section>
  );
}
