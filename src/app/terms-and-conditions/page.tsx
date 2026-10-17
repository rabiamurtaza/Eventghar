import Link from "next/link";
import { ShieldCheck, ArrowRight, FileText, CheckCircle2, AlertTriangle } from "lucide-react";

export default function TermsAndConditionsPage() {
  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 py-12 sm:py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        
        {/* Header */}
        <div className="mb-10 text-center sm:text-left">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 mb-3">
            <FileText className="w-3.5 h-3.5" />
            <span>Official Platform Policies</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-neutral-900 dark:text-white tracking-tight">
            Terms & Conditions
          </h1>
          <p className="mt-2 text-xs sm:text-sm text-neutral-500 dark:text-neutral-400">
            Last updated: October 2026 • Effective across all Event Ghar portals and ticketing channels
          </p>
        </div>

        {/* Highlight Callouts Banner */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          <div className="rounded-2xl border border-emerald-200/80 dark:border-emerald-800/60 bg-emerald-50/50 dark:bg-emerald-950/20 p-5">
            <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold text-sm mb-1">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Verifiable Digital Pass</span>
            </div>
            <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
              Every verified booking generates a cryptographic QR ticket code. Gate scanners scan in real time to guarantee single-entry authenticity.
            </p>
          </div>

          <div className="rounded-2xl border border-amber-200/80 dark:border-amber-800/60 bg-amber-50/50 dark:bg-amber-950/20 p-5">
            <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-bold text-sm mb-1">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>Student ID Requirement</span>
            </div>
            <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
              Events designated as Student-Only require an uploaded photo of your university card during checkout, plus physical card check at the gate.
            </p>
          </div>
        </div>

        {/* Policy Body */}
        <div className="bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200/80 dark:border-neutral-800 p-6 sm:p-10 shadow-sm space-y-8 text-xs sm:text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed">
          
          <section>
            <h2 className="text-base sm:text-lg font-bold text-neutral-900 dark:text-white mb-2 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 text-xs font-bold">1</span>
              <span>Acceptance of Platform Terms</span>
            </h2>
            <p>
              By accessing the Event Ghar platform, browsing events, booking passes, or registering as an event organizer, you agree to abide by all operational terms, safety regulations, and gate entry protocols stipulated herein.
            </p>
          </section>

          <section>
            <h2 className="text-base sm:text-lg font-bold text-neutral-900 dark:text-white mb-2 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 text-xs font-bold">2</span>
              <span>Ticket Booking & Payment Verification</span>
            </h2>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li>All manual payments (Easypaisa, JazzCash, direct bank transfer) must include a clear, legible payment screenshot with transaction ID and timestamp.</li>
              <li>Bookings are placed in <strong>Pending</strong> status until verified by our payment officers or the verified event host.</li>
              <li>Upon verification, your digital QR pass will be available immediately in your <strong>My Tickets</strong> portal.</li>
              <li>Event Ghar reserves the right to cancel bookings containing altered, duplicate, or unverified transaction slips.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base sm:text-lg font-bold text-neutral-900 dark:text-white mb-2 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 text-xs font-bold">3</span>
              <span>Gate Entry, QR Scanner & Pass Validity</span>
            </h2>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li>Each QR ticket code is single-entry. Once scanned at the gate terminal, it cannot be reused.</li>
              <li>Attendees must present their digital QR pass on mobile or in printed format, along with physical CNIC / Student ID card if mandated.</li>
              <li>Organizers and security officers reserve the right of admission in accordance with venue rules.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base sm:text-lg font-bold text-neutral-900 dark:text-white mb-2 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 text-xs font-bold">4</span>
              <span>Organizer Responsibilities & Code of Conduct</span>
            </h2>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li>Organizers must provide true and accurate event descriptions, timings, artist lineups, and venue locations.</li>
              <li>Organizers are responsible for on-ground safety, security permits, and ensuring peaceful event conduction.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base sm:text-lg font-bold text-neutral-900 dark:text-white mb-2 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 text-xs font-bold">5</span>
              <span>Refunds, Postponements & Cancellations</span>
            </h2>
            <p>
              In the event of cancellation or rescheduling by an organizer, notices and refund processing guidelines will be posted on the event listing and dispatched via email / SMS to registered ticket holders.
            </p>
          </section>

          {/* Contact Support Footer Strip inside card */}
          <div className="pt-6 border-t border-neutral-100 dark:border-neutral-800 flex flex-col sm:flex-row items-center justify-between gap-4">
            <Link
              href="/"
              className="text-xs font-semibold text-neutral-600 dark:text-neutral-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition"
            >
              ← Return to Catalog
            </Link>
            <Link
              href="/contact-us"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-5 py-2.5 text-xs font-bold text-white transition hover:from-emerald-600 hover:to-emerald-700 shadow-sm"
            >
              <span>Have a Question? Contact Support</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

        </div>

      </div>
    </div>
  );
}
