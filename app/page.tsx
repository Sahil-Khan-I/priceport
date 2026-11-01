import Hero from "@/components/landing/Hero";
import ProblemSection from "@/components/landing/ProblemSection";
import MarketLensSection from "@/components/landing/MarketLensSection";
import InvestigationRoomSection from "@/components/landing/InvestigationRoomSection";
import TinyFishSection from "@/components/landing/TinyFishSection";
import HowItWorks from "@/components/landing/HowItWorks";
import TrueCostSection from "@/components/landing/TrueCostSection";
import CategoriesSection from "@/components/landing/CategoriesSection";
import FinalCTA from "@/components/landing/FinalCTA";

export default function HomePage() {
  return (
    <>
      <Hero />
      <ProblemSection />
      <HowItWorks />
      <MarketLensSection />
      <InvestigationRoomSection />
      <TinyFishSection />
      <TrueCostSection />
      <CategoriesSection />
      <FinalCTA />
    </>
  );
}
