import Container from "@/components/ui/Container";
import SectionHeading from "@/components/ui/SectionHeading";
import Reveal from "@/components/ui/Reveal";

const steps = [
  {
    title: "Describe the stay",
    detail:
      "Destination, dates, guests, and the providers or markets you care about.",
  },
  {
    title: "Agents investigate",
    detail:
      "TinyFish opens real booking sites, searches, and extracts structured findings.",
  },
  {
    title: "Priceport reasons",
    detail:
      "We normalize currencies, classify fees, check eligibility, and rank bookable deals.",
  },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="py-20 sm:py-24">
      <Container>
        <Reveal>
          <SectionHeading
            eyebrow="How it works"
            title="Investigation first. Comparison second."
            description="Priceport is built around autonomous web investigations — not scraping APIs dressed up as intelligence."
            align="center"
            className="mx-auto"
          />
        </Reveal>

        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {steps.map((step, index) => (
            <Reveal key={step.title} delay={index * 80}>
              <div className="h-full rounded-[24px] border border-pp-border bg-pp-white p-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-pp-accent/10 text-sm font-semibold text-pp-accent">
                  {index + 1}
                </div>
                <h3 className="mt-5 text-lg font-semibold tracking-tight text-pp-text">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-pp-muted">
                  {step.detail}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
