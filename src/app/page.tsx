import EventsSection from "@/components/EventsSection";

export default function Home() {
  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="text-center py-12">
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
            Discover & Experience Great Events
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">
            Find the latest concerts, workshops, conferences, and meetups happening near you.
          </p>
        </section>

        <EventsSection />
      </main>
    </div>
  );
} 