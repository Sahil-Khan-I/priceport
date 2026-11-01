import Container from "@/components/ui/Container";
import SectionHeading from "@/components/ui/SectionHeading";
import Reveal from "@/components/ui/Reveal";

const manual = [
  "Open five booking tabs",
  "Switch currencies by hand",
  "Guess which fees are mandatory",
  "Wonder if the India price is bookable",
  "Lose the trail across regions",
];

const priceport = [
  "Agents investigate providers in parallel",
  "Market contexts stay explicit",
  "Fees are classified — never assumed zero",
  "Eligibility is separated from availability",
  "One Market Lens recommendation set",
];

export default function ProblemSection() {
  return (
    <section className="bg-pp-bg-secondary py-20 sm:py-24">
      <Container>
        <Reveal>
          <SectionHeading
            eyebrow="The problem"
            title="One hotel. Five websites. Countless tabs."
            description="People manually compare providers, countries, currencies, hidden fees, room conditions, and regional discounts — then still wonder which offer is real."
          />
        </Reveal>

        <div className="mt-12 grid gap-5 lg:grid-cols-2">
          <Reveal>
            <div className="h-full rounded-[24px] border border-pp-border bg-pp-white p-6 sm:p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-pp-coral">
                Manual comparison
              </p>
              <ul className="mt-5 space-y-3">
                {manual.map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-3 text-sm text-pp-muted"
                  >
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-pp-coral/70" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>

          <Reveal delay={100}>
            <div className="h-full rounded-[24px] border border-pp-accent/25 bg-pp-white p-6 shadow-pp-lift sm:p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-pp-accent">
                With Priceport
              </p>
              <ul className="mt-5 space-y-3">
                {priceport.map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-3 text-sm text-pp-text"
                  >
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-pp-accent" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}
