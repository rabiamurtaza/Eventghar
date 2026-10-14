import EventsSection from "@/components/EventsSection";

export default function Home() {
  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="text-center py-12">
          <span className="inline-block rounded-full bg-purple-50 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-purple-700 border border-purple-200">
            Welcome to Event Ghar
          </span>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
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