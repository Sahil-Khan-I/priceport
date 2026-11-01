import Container from "@/components/ui/Container";
import SectionHeading from "@/components/ui/SectionHeading";
import Reveal from "@/components/ui/Reveal";
import MarketLensPreview from "@/components/visuals/MarketLensPreview";

export default function MarketLensSection() {
  return (
    <section id="market-lens" className="py-20 sm:py-24">
      <Container>
        <Reveal>
          <SectionHeading
            eyebrow="Market Lens"
            title="See what the world is paying."
            description="Priceport separates user country, browser IP country, provider storefront, currency, residence, and eligibility. Changing a currency selector is not the same as a verified regional investigation."
          />
        </Reveal>

        <Reveal className="mt-12" delay={80}>
          <MarketLensPreview />
        </Reveal>

        <Reveal className="mt-8">
          <p className="max-w-3xl text-sm leading-relaxed text-pp-muted">
            Lowest found and cheapest bookable can differ — regional discounts,
            payment restrictions, or unsupported proxy markets may make an
            attractive price unreachable. Priceport keeps both recommendations
            visible so you can decide with clear evidence.
          </p>
        </Reveal>
      </Container>
    </section>
  );
}
