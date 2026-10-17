import Link from "next/link";

export default function TermsAndConditionsPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-neutral-950 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white dark:bg-neutral-900 rounded-3xl border border-slate-200 dark:border-neutral-800 p-8 sm:p-12 shadow-sm">
        <div className="border-b border-slate-100 dark:border-neutral-800 pb-6 mb-8">
          <span className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
            Legal & Policies
          </span>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white mt-1">
            Terms & Conditions
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-neutral-400">
            Last updated: October 2026
          </p>
        </div>

        <div className="space-y-8 text-sm text-slate-600 dark:text-neutral-300 leading-relaxed">
          <section>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-2">1. Introduction</h2>
            <p>
              Welcome to <strong>Event Ghar</strong>. By accessing our platform, booking tickets, or hosting events with us, you agree to comply with and be bound by the following terms and conditions. Please review them carefully before making any purchases or submitting event hosting requests.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-2">2. Ticket Booking & Payment Verification</h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>All ticket bookings require a valid manual payment screenshot uploaded through the checkout page.</li>
              <li>Bookings remain in <em>Pending</em> verification status until our administrators or verified event organizers authenticate the transaction.</li>
              <li>Once payment is verified, unique digital tickets with verifiable QR codes will be issued immediately in your account under <strong>My Tickets</strong>.</li>
              <li>Event Ghar reserves the right to reject bookings submitted with fraudulent, illegible, or duplicate payment proofs.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-2">3. Student Restrictions & Gate Entry</h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Events marked as &quot;Student Only&quot; strictly require a valid Student ID card photo during checkout.</li>
              <li>Gate scanners and security personnel reserve the right to verify the attendee&apos;s physical student ID card and QR ticket before granting entry.</li>
              <li>Tickets are non-transferable unless permitted in the specific event guidelines.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-2">4. Event Hosting & Organizers</h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Users requesting to host events must provide accurate contact and event details.</li>
              <li>Admin review is required before any organizer account is provisioned or events are published.</li>
              <li>Event organizers are solely responsible for event execution, venue arrangements, and attendee conduct at the venue.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-2">5. Cancellations & Refunds</h2>
            <p>
              Refund policies depend on the individual event organizer. If an event is cancelled by the organizers or platform, announcements and refund instructions will be communicated to the registered email and phone number.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-2">6. Contact Support</h2>
            <p>
              For any questions regarding these terms, payment verification, or ticket queries, please visit our{" "}
              <Link href="/contact-us" className="text-purple-600 dark:text-purple-400 font-semibold hover:underline">
                Contact Us
              </Link>{" "}
              page or reach out to us at <strong>support@eventghar.pk</strong>.
            </p>
          </section>
        </div>

        <div className="mt-10 pt-6 border-t border-slate-100 dark:border-neutral-800 flex justify-between items-center">
          <Link
            href="/"
            className="text-sm font-semibold text-purple-600 dark:text-purple-400 hover:underline"
          >
            ← Back to Home
          </Link>
          <Link
            href="/contact-us"
            className="rounded-xl bg-purple-600 hover:bg-purple-700 px-5 py-2.5 text-xs font-bold text-white transition shadow-sm"
          >
            Have a Question? Contact Us
          </Link>
        </div>
      </div>
    </div>
  );
}
