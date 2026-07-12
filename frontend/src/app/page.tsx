import { Ambient } from "@/components/landing/ambient";
import { Hero } from "@/components/landing/hero";
import { LandingNav } from "@/components/landing/nav";

export default function LandingPage() {
  return (
    <div className="relative min-h-dvh overflow-x-clip">
      <Ambient />
      <LandingNav />

      <main id="main">
        <Hero />
      </main>
    </div>
  );
}
