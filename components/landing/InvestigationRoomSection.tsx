import Container from "@/components/ui/Container";
import SectionHeading from "@/components/ui/SectionHeading";
import Reveal from "@/components/ui/Reveal";
import InvestigationPreview from "@/components/visuals/InvestigationPreview";

export default function InvestigationRoomSection() {
  return (
    <section id="investigation" className="bg-pp-dark py-20 sm:py-24">
      <Container>
        <Reveal>
          <SectionHeading
            dark
            eyebrow="Investigation Room"
            title="Not another search engine. An investigation engine."
            description="Priceport uses TinyFish-powered autonomous web agents to investigate actual websites — opening providers, applying filters, extracting prices, and returning structured findings with source evidence."
          />
        </Reveal>

        <Reveal className="mt-12" delay={80}>
          <InvestigationPreview />
        </Reveal>
      </Container>
    </section>
  );
}
