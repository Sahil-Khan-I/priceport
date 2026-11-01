import Link from "next/link";
import Container from "@/components/ui/Container";
import SectionHeading from "@/components/ui/SectionHeading";
import Button from "@/components/ui/Button";

export const metadata = {
  title: "Market Lens — Priceport",
  description:
    "Market Lens compares real TinyFish investigation results. Start a search to generate live evidence.",
};

export default function MarketLensPage() {
  return (
    <Container className="py-16">
      <SectionHeading
        eyebrow="Market Lens"
        title="Results come from live investigations."
        description="This route no longer shows sample prices. Run a hotel search to create a real investigation, then open its results page."
      />
      <div className="mt-8 flex gap-3">
        <Button href="/search">Start comparing</Button>
        <Link
          href="/#market-lens"
          className="inline-flex items-center text-sm text-pp-muted hover:text-pp-text"
        >
          See landing preview
        </Link>
      </div>
    </Container>
  );
}
