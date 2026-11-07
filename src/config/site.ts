/**
 * Single source of truth for contact details and navigation.
 * Buttons and links must read from here (or from real data) instead of
 * hardcoding numbers, emails or URLs inside components.
 */

const whatsappDigits = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP || "923325727917";

export const siteConfig = {
  name: "EventGhar",
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "eventghar1@gmail.com",
  whatsapp: {
    digits: whatsappDigits,
    // 923325727917 -> 0332 5727917
    display: whatsappDigits.startsWith("92")
      ? `0${whatsappDigits.slice(2, 5)} ${whatsappDigits.slice(5)}`
      : whatsappDigits,
    url: `https://wa.me/${whatsappDigits}`,
  },
  instagram: {
    handle: "eventgharofficial",
    url: "https://instagram.com/eventgharofficial",
  },
  /** Links shown in the middle of the top bar (desktop). */
  navLinks: [
    { href: "/#events", label: "Events" },
    { href: "/#how-it-works", label: "How it works" },
    { href: "/contact-us", label: "Contact" },
  ],
} as const;
