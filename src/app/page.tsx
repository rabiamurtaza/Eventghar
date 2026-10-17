import HeroSlider from "@/components/HeroSlider";
import EventsSection from "@/components/EventsSection";
import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white">
      {/* 1. Full-width edge-to-edge Hero Slider */}
      <HeroSlider />

      {/* 2. Value Proposition Strip */}
      <section className="border-y border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900/60 shadow-xs backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            
            <div className="flex items-start gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 shadow-xs">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                </svg>
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">Instant QR Passes</h4>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Verified digital tickets delivered straight to your account.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-xs">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">Verified Events</h4>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Curated festivals, concerts, and workshops by verified hosts.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 shadow-xs">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">Local Payments</h4>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Easypaisa, JazzCash, Raast, and instant bank transfer.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shadow-xs">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">Express Gate Scan</h4>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Real-time multi-scanner entrance to avoid queue delays.
                </p>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 3. Main Catalog */}
      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <EventsSection />

        {/* 4. Host an Event Banner */}
        <div className="mt-16 rounded-3xl bg-gradient-to-r from-indigo-900 via-purple-900 to-slate-950 p-8 sm:p-12 text-white shadow-xl relative overflow-hidden border border-indigo-500/20">
          <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 max-w-2xl">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-white/10 text-indigo-200 border border-white/20 mb-4 backdrop-blur-xs">
              For Organizers & Creators
            </span>
            <h3 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
              Hosting a Concert, Workshop, or Fest?
            </h3>
            <p className="mt-3 text-sm sm:text-base text-indigo-100/90 leading-relaxed">
              Publish your event on Event Ghar, manage ticket tiers, authenticate payments, and track live attendee attendance with our camera QR scanner.
            </p>
            <div className="mt-6 flex flex-wrap gap-4 items-center">
              <Link
                href="/book-event"
                className="rounded-xl bg-white px-6 py-3.5 text-xs sm:text-sm font-bold text-slate-900 transition hover:bg-slate-100 shadow-lg shadow-black/20"
              >
                Request to Host Event →
              </Link>
              <Link
                href="/contact-us"
                className="rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 px-6 py-3.5 text-xs sm:text-sm font-bold text-white transition backdrop-blur-xs"
              >
                Contact Partnerships
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}