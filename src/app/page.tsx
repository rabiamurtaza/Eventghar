import HeroSlider from "@/components/HeroSlider";
import EventsSection from "@/components/EventsSection";

export default function Home() {
  return (
    <div className="min-h-screen">
      {/* 1. Full-width edge-to-edge Hero Slider */}
      <HeroSlider />

      {/* 2. Constrained container starting right below the hero */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <EventsSection />
      </main>
    </div>
  );
} 