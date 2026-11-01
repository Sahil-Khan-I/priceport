import Container from "@/components/ui/Container";
import Button from "@/components/ui/Button";
import Reveal from "@/components/ui/Reveal";
import HeroComparison from "@/components/visuals/HeroComparison";

export default function Hero() {
  return (
    <section id="hero" className="relative overflow-hidden pb-16 pt-14 sm:pb-24 sm:pt-20">
      <div className="pp-grid-wash pointer-events-none absolute inset-0" />
      <div className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-pp-accent/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 top-40 h-64 w-64 rounded-full bg-pp-lavender/20 blur-3xl" />

      <Container className="relative">
        <Reveal>
          <p className="text-sm font-medium tracking-wide text-pp-accent">
            Priceport
          </p>
          <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-pp-text sm:text-5xl lg:text-6xl lg:leading-[1.05]">
            Same world. Different prices.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-pp-muted sm:text-lg">
            Priceport sends AI agents across booking websites and global markets
            to investigate prices, uncover regional differences, and find the
            best deals you can actually book.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button href="/search">Explore Priceport</Button>
            <Button href="#how-it-works" variant="secondary">
              See how it works
            </Button>
          </div>
        </Reveal>

        <Reveal className="mt-12 sm:mt-16" delay={120}>
          <HeroComparison />
        </Reveal>
      </Container>
    </section>
  );
}
