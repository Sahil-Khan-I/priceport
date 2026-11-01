import Container from "@/components/ui/Container";
import Button from "@/components/ui/Button";
import Reveal from "@/components/ui/Reveal";

export default function FinalCTA() {
  return (
    <section className="py-20 sm:py-24">
      <Container>
        <Reveal>
          <div className="relative overflow-hidden rounded-[32px] border border-pp-border bg-pp-dark px-6 py-14 text-center sm:px-12">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(70,137,255,0.28),transparent_55%)]" />
            <div className="relative">
              <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                Your next great deal is out there.
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-base text-white/65">
                Let intelligent agents investigate the web. Compare smarter. Buy
                better.
              </p>
              <div className="mt-8 flex justify-center">
                <Button href="/search" variant="dark">
                  Explore Priceport
                </Button>
              </div>
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
