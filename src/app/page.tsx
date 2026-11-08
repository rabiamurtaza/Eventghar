import Link from "next/link";
import HeroSlider from "@/components/HeroSlider";
import EventsSection from "@/components/EventsSection";
import SectionHeader from "@/components/SectionHeader";
import { siteConfig } from "@/config/site";
import EmailLink from "@/components/EmailLink";

const STEPS = [
  {
    title: "Pick an event",
    body: "Find an event you like and tap it. Log in when you are ready to book.",
  },
  {
    title: "Pay and send the receipt",
    body: "Pay by Easypaisa, JazzCash or bank transfer, then upload a screenshot.",
  },
  {
    title: "Get your ticket",
    body: "Once your payment is confirmed, your QR ticket appears in My Account. Show it at the gate.",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen w-full overflow-x-hidden">
      {/* 1. Full-width edge-to-edge Hero Slider */}
      <HeroSlider />

      {/* 2. Constrained container starting right below the hero */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-16 sm:space-y-24 w-full">
        {/* Events listing & filters */}
        <EventsSection />

        {/* Section: How booking works */}
        <section id="how-it-works" aria-labelledby="how-booking-works-heading" className="w-full scroll-mt-24">
          <SectionHeader
            title="How booking works"
            subtitle="Three easy steps, all from your phone."
            titleId="how-booking-works-heading"
          />

          <ol className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
            {STEPS.map((step, i) => (
              <li
                key={step.title}
                className="bg-white border border-neutral-200/90 rounded-3xl p-6 sm:p-8 shadow-sm"
              >
                <span
                  aria-hidden="true"
                  className="font-serif-display block text-6xl sm:text-7xl leading-none text-[#7a1fd1] mb-5"
                >
                  {i + 1}
                </span>
                <h3 className="font-heading font-semibold text-xl sm:text-2xl text-[#1c1230] mb-2">
                  {step.title}
                </h3>
                <p className="text-base text-neutral-600 font-body leading-relaxed">
                  {step.body}
                </p>
              </li>
            ))}
          </ol>
        </section>

        {/* Section: Running an event? (virtual card with contact details) */}
        <section aria-labelledby="running-event-heading" className="w-full pb-4">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#3a1a6e] via-[#2a1450] to-[#160b28] p-6 sm:p-10 lg:p-12 text-white shadow-xl ring-1 ring-white/10">
            {/* Decorative card circles */}
            <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-[#7a1fd1]/40" />
            <div aria-hidden="true" className="pointer-events-none absolute -bottom-28 left-1/3 h-64 w-64 rounded-full bg-white/5" />

            <div className="relative z-10 grid gap-8 md:grid-cols-5 md:gap-12 md:items-center">
              {/* Left: message + main button */}
              <div className="md:col-span-3">
                <p className="mb-4 inline-block rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.2em] text-purple-100">
                  For organizers
                </p>
                <h2
                  id="running-event-heading"
                  className="font-serif-display text-3xl sm:text-4xl lg:text-5xl font-medium leading-[1.08] text-white mb-4"
                >
                  Running an event?
                </h2>
                <p className="max-w-md text-purple-100/90 text-sm sm:text-base font-sans leading-relaxed mb-7">
                  Tell us about it. We’ll set up your event page, take bookings and check tickets at the gate.
                </p>
                <Link
                  href="/book-event"
                  className="inline-flex items-center justify-center rounded-full bg-white px-7 py-3.5 font-body font-semibold text-[#1c1230] shadow-md transition-all duration-200 hover:bg-neutral-100 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#2a1450]"
                >
                  Request an event
                </Link>
              </div>

              {/* Right: tap-to-contact tiles */}
              <div className="md:col-span-2 flex flex-col gap-3">
                <a
                  href={siteConfig.whatsapp.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex h-16 items-center gap-4 rounded-full bg-[#25D366] pl-3 pr-6 text-[#052e16] shadow-lg shadow-black/20 transition-all duration-200 hover:bg-[#2fe574] hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#2a1450]"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[#128C4A]">
                    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden="true">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                    </svg>
                  </span>
                  <span className="min-w-0 flex-1 leading-tight">
                    <span className="block text-xs font-medium text-[#052e16]/70">Chat on WhatsApp</span>
                    <span className="block font-semibold tabular-nums">{siteConfig.whatsapp.display}</span>
                  </span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0 transition-transform duration-200 group-hover:translate-x-1" aria-hidden="true"><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></svg>
                </a>
                <EmailLink
                  className="group flex h-16 items-center gap-4 rounded-full border border-white/30 bg-white/5 pl-3 pr-6 text-white transition-all duration-200 hover:bg-white hover:text-[#1c1230] hover:border-white hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#2a1450]"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#7a1fd1] text-white">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
                      <rect x="3" y="5" width="18" height="14" rx="2" />
                      <path d="m3 7 9 6 9-6" />
                    </svg>
                  </span>
                  <span className="min-w-0 flex-1 leading-tight">
                    <span className="block text-xs font-medium opacity-70">Email us</span>
                    <span className="block truncate font-semibold">{siteConfig.supportEmail}</span>
                  </span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0 transition-transform duration-200 group-hover:translate-x-1" aria-hidden="true"><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></svg>
                </EmailLink>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}