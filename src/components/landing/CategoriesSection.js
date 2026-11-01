import Container from "@/components/ui/Container";
import SectionHeading from "@/components/ui/SectionHeading";
import Reveal from "@/components/ui/Reveal";
import Badge from "@/components/ui/Badge";
import { CATEGORIES } from "@/lib/constants";

export default function CategoriesSection() {
  return (
    <section className="bg-pp-bg-secondary py-20 sm:py-24">
      <Container>
        <Reveal>
          <SectionHeading
            eyebrow="More than travel"
            title="One investigation engine. More markets to explore."
            description="Hotels lead Phase 01. The same investigation architecture is designed to expand into adjacent categories without rebuilding the core."
            align="center"
            className="mx-auto"
          />
        </Reveal>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CATEGORIES.map((category, index) => (
            <Reveal key={category.id} delay={index * 50}>
              <div
                className={`rounded-2xl border p-5 ${
                  category.status === "live"
                    ? "border-pp-accent/30 bg-pp-white shadow-pp-lift"
                    : "border-pp-border bg-pp-white"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-base font-semibold text-pp-text">
                    {category.label}
                  </h3>
                  <Badge tone={category.status === "live" ? "accent" : "muted"}>
                    {category.status === "live" ? "Initial focus" : "Coming soon"}
                  </Badge>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
