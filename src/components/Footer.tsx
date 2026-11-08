import Link from "next/link";
import { Mail } from "lucide-react";
import { siteConfig } from "@/config/site";

export default function Footer() {
  return (
    <footer className="bg-[#160b28] text-gray-300 py-8 mt-auto border-t border-[#2a1450]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Brand & About */}
          <div>
            <h3 className="text-xl font-semibold text-white mb-2">Event Ghar</h3>
            <p className="text-gray-400 text-sm leading-relaxed max-w-sm">
              Discover and book tickets for exciting events near you. Join us for unforgettable experiences and create lasting memories.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-3">Quick Links</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/" className="hover:text-white transition-colors duration-200">
                  Home
                </Link>
              </li>
              <li>
                <Link href="/terms-and-conditions" className="hover:text-white transition-colors duration-200">
                  Terms & Conditions
                </Link>
              </li>
              <li>
                <Link href="/contact-us" className="hover:text-white transition-colors duration-200">
                  Contact Us
                </Link>
              </li>
            </ul>
          </div>

          {/* Socials & Contact */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-3">Connect With Us</h3>
            
            <p className="text-sm text-gray-400 mb-2">
              <a href={siteConfig.instagram.url} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors duration-200">
                Instagram @{siteConfig.instagram.handle}
              </a>
            </p>
            <p className="text-sm flex items-center text-gray-400">
              <Mail className="h-4 w-4 mr-2" />
              <a href={siteConfig.emailUrl} className="hover:text-white transition-colors duration-200">
                {siteConfig.supportEmail}
              </a>
            </p>
            <p className="mt-4 text-xs text-gray-500">
              &copy; {new Date().getFullYear()} Event Ghar. All rights reserved.
            </p>
          </div>
        </div>

      </div>
    </footer>
  );
}
