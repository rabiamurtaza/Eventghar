import Link from "next/link";
import { Mail, ShieldCheck, Heart, Sparkles, ExternalLink } from "lucide-react";

export default function Footer() {
  return (
    <footer className="border-t border-neutral-200/80 dark:border-neutral-800/80 bg-white dark:bg-neutral-950 text-neutral-600 dark:text-neutral-400 mt-auto transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        
        {/* Main Footer Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 lg:gap-10">
          
          {/* Brand & Mission (2 cols on lg) */}
          <div className="lg:col-span-2 space-y-4">
            <Link href="/" className="inline-flex items-center gap-2.5 group">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-white shadow-md shadow-emerald-500/20 group-hover:scale-105 transition-transform">
                <Sparkles className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-lg font-black tracking-tight text-neutral-900 dark:text-white leading-none">
                  Event Ghar
                </span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 mt-0.5">
                  Fast Events Network
                </span>
              </div>
            </Link>

            <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed max-w-sm">
              Pakistan&apos;s premier event discovery and automated ticketing platform. Empowering university fests, music concerts, and conferences with instant verifiable QR passes.
            </p>

            <div className="flex items-center gap-3 pt-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Real-Time Systems Operational
              </span>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-900 dark:text-white mb-4">
              Explore Events
            </h4>
            <ul className="space-y-2.5 text-xs sm:text-sm">
              <li>
                <Link href="/" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition">
                  All Live Events
                </Link>
              </li>
              <li>
                <Link href="/?category=Concert" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition">
                  Concerts & Gigs
                </Link>
              </li>
              <li>
                <Link href="/?category=Qawwali+Nights" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition">
                  Qawwali Nights
                </Link>
              </li>
              <li>
                <Link href="/?category=Technology" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition">
                  Tech & Hackathons
                </Link>
              </li>
            </ul>
          </div>

          {/* For Organizers */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-900 dark:text-white mb-4">
              Organizers
            </h4>
            <ul className="space-y-2.5 text-xs sm:text-sm">
              <li>
                <Link href="/book-event" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition font-medium flex items-center gap-1">
                  <span>Host an Event</span>
                  <span className="text-[10px] font-bold text-emerald-500 uppercase px-1.5 py-0.2 rounded bg-emerald-50 dark:bg-emerald-950">Free</span>
                </Link>
              </li>
              <li>
                <Link href="/my-account" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition">
                  Organizer Desk
                </Link>
              </li>
              <li>
                <Link href="/contact-us" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition">
                  Corporate Inquiries
                </Link>
              </li>
            </ul>
          </div>

          {/* Support & Legal */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-900 dark:text-white mb-4">
              Trust & Support
            </h4>
            <ul className="space-y-2.5 text-xs sm:text-sm">
              <li>
                <Link href="/contact-us" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition">
                  Help Desk & Contact
                </Link>
              </li>
              <li>
                <Link href="/terms-and-conditions" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition">
                  Terms & Conditions
                </Link>
              </li>
              <li>
                <a 
                  href="mailto:support@eventghar.pk" 
                  className="hover:text-emerald-600 dark:hover:text-emerald-400 transition flex items-center gap-1.5"
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>support@eventghar.pk</span>
                </a>
              </li>
            </ul>
          </div>

        </div>

        {/* Bottom Bar: Trust Badges & Copyright */}
        <div className="mt-12 pt-8 border-t border-neutral-100 dark:border-neutral-800/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-neutral-400 dark:text-neutral-500">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>256-bit Encrypted Checkout • Verified RFC 9562 UUID v7 Architecture</span>
          </div>

          <div className="flex items-center gap-1">
            <span>&copy; {new Date().getFullYear()} Event Ghar. Built with care for Pakistani event creators.</span>
          </div>
        </div>

      </div>
    </footer>
  );
}
