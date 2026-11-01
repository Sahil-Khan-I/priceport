import Container from "@/components/ui/Container";
import SectionHeading from "@/components/ui/SectionHeading";
import Reveal from "@/components/ui/Reveal";
import PriceBreakdownPreview from "@/components/visuals/PriceBreakdownPreview";

export default function TrueCostSection() {
  return (
    <section id="features" className="py-20 sm:py-24">
      <Container>
        <div className="grid items-start gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <Reveal>
            <SectionHeading
              eyebrow="True Cost Engine"
              title="The cheapest displayed price isn't always the cheapest deal."
              description="Base rates, taxes, service fees, booking fees, estimated charges, and unknown costs are tracked separately. Unknown fees are never silently treated as zero."
            />
          </Reveal>
          <Reveal delay={80}>
            <PriceBreakdownPreview />
          </Reveal>
        </div>
      </Container>
    </section>
  );
}
