/**
 * Site-wide settings in ONE place.
 * Change contact details, social links, cities or categories here and they update everywhere.
 * Contact values can also be overridden with environment variables in Vercel.
 */

// Support contact
export const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "eventghar1@gmail.com";
// WhatsApp number in international format without "+" (used for wa.me links) - 0332 5727917
export const SUPPORT_WHATSAPP = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP || "923325727917";

// "Email us" link: opens the visitor's mail app with a new email already addressed to us,
// with a subject and a short message to fill in (like the prefilled WhatsApp message).
const EMAIL_SUBJECT = "Event Ghar enquiry";
const EMAIL_BODY = [
  "Hello Event Ghar team,",
  "",
  "My name:",
  "My phone:",
  "Event (if any):",
  "",
  "My question:",
  "",
].join("\r\n");
export const SUPPORT_EMAIL_URL = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(EMAIL_SUBJECT)}&body=${encodeURIComponent(EMAIL_BODY)}`;

// Social links (leave empty to hide the icon)
export const INSTAGRAM_URL = process.env.NEXT_PUBLIC_INSTAGRAM_URL || "https://www.instagram.com/eventgharofficial/";

// Cities and event categories used in filters and event forms
export const CITIES = ["Karachi", "Lahore", "Islamabad", "Rawalpindi", "Faisalabad"];
export const CATEGORIES = [
  "Trips",
  "Qawwali Nights",
  "Concert",
  "Music",
  "Technology",
  "Food",
  "Business",
  "Arts",
  "Sports",
  "University Fest",
  "Workshop",
];

/**
 * Grouped values used by the navbar, footer and home page.
 * Buttons and links must read from here (or from real data) instead of
 * hardcoding numbers, emails or URLs inside components.
 */
export const siteConfig = {
  name: "EventGhar",
  supportEmail: SUPPORT_EMAIL,
  /** mailto link with the subject and message already filled in. */
  emailUrl: SUPPORT_EMAIL_URL,
  whatsapp: {
    digits: SUPPORT_WHATSAPP,
    // 923325727917 -> 0332 5727917
    display: SUPPORT_WHATSAPP.startsWith("92")
      ? `0${SUPPORT_WHATSAPP.slice(2, 5)} ${SUPPORT_WHATSAPP.slice(5)}`
      : SUPPORT_WHATSAPP,
    url: `https://wa.me/${SUPPORT_WHATSAPP}`,
  },
  instagram: {
    handle: "eventgharofficial",
    url: INSTAGRAM_URL,
  },
  /** Links shown in the middle of the top bar (desktop). */
  navLinks: [
    { href: "/#events", label: "Events" },
    { href: "/#how-it-works", label: "How it works" },
    { href: "/contact-us", label: "Contact" },
  ],
} as const;
