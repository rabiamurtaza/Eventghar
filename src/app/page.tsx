import Link from "next/link";
import HeroSlider from "@/components/HeroSlider";
import EventsSection from "@/components/EventsSection";

export default function Home() {
  return (
    <div className="min-h-screen">
      {/* 1. Full-width edge-to-edge Hero Slider */}
      <HeroSlider />

      {/* 2. Constrained container starting right below the hero */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-20 sm:space-y-24">
        {/* Events listing & filters */}
        <EventsSection />

        {/* Section: How booking works */}
        <section aria-labelledby="how-booking-works-heading" className="pt-4">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2
              id="how-booking-works-heading"
              className="text-2xl sm:text-3xl font-heading font-extrabold text-[#1c1230] dark:text-white"
            >
              How booking works
            </h2>
            <p className="mt-2 text-sm sm:text-base text-gray-600 dark:text-gray-300 font-sans">
              Three steps, and you can do it all from your phone.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            {/* Step 1 */}
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-3xl p-6 sm:p-8 flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-[#f6effd] dark:bg-purple-950/50 text-[#7a1fd1] dark:text-purple-300 font-heading font-black text-xl flex items-center justify-center mb-5">
                  1
                </div>
                <h3 className="font-heading font-bold text-lg text-[#1c1230] dark:text-white mb-2">
                  Choose an event
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-300 font-sans leading-relaxed">
                  Open any event to see the date, place and price. Log in with your email when you’re ready to book.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-3xl p-6 sm:p-8 flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-[#f6effd] dark:bg-purple-950/50 text-[#7a1fd1] dark:text-purple-300 font-heading font-black text-xl flex items-center justify-center mb-5">
                  2
                </div>
                <h3 className="font-heading font-bold text-lg text-[#1c1230] dark:text-white mb-2">
                  Pay and upload your receipt
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-300 font-sans leading-relaxed">
                  Send the money by Easypaisa, JazzCash or bank transfer, then upload a screenshot of the payment.
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-3xl p-6 sm:p-8 flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-[#f6effd] dark:bg-purple-950/50 text-[#7a1fd1] dark:text-purple-300 font-heading font-black text-xl flex items-center justify-center mb-5">
                  3
                </div>
                <h3 className="font-heading font-bold text-lg text-[#1c1230] dark:text-white mb-2">
                  Get your ticket
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-300 font-sans leading-relaxed">
                  Once the organizer confirms your payment, your QR ticket arrives by email and sits in My Tickets. Show it at the gate.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Section: Running an event? */}
        <section
          aria-labelledby="running-event-heading"
          className="bg-[#2a1450] text-white rounded-3xl p-8 sm:p-12 shadow-xl border border-purple-500/20 relative overflow-hidden"
        >
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="max-w-xl">
              <h2
                id="running-event-heading"
                className="text-2xl sm:text-3xl font-heading font-extrabold text-white mb-2"
              >
                Running an event?
              </h2>
              <p className="text-purple-100/90 text-sm sm:text-base font-sans leading-relaxed">
                Tell us about it. We’ll set up your event page, take bookings and check tickets at the gate.
              </p>
            </div>
            <div className="flex-shrink-0">
              <Link
                href="/book-event"
                className="inline-flex items-center justify-center px-6 py-3.5 rounded-full font-heading font-semibold text-[#1c1230] bg-white hover:bg-neutral-100 transition-all duration-200 shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#2a1450]"
              >
                Request an event
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}