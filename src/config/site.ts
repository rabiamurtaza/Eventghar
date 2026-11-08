export const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "eventghar1@gmail.com";
export const SUPPORT_WHATSAPP = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP || "923325727917";
export const INSTAGRAM_URL = process.env.NEXT_PUBLIC_INSTAGRAM_URL || "https://www.instagram.com/eventgharofficial/";
export const CITIES = ["Karachi", "Lahore", "Islamabad", "Rawalpindi", "Faisalabad"];
export const CATEGORIES = ["Trips","Qawwali Nights","Concert","Music","Technology","Food","Business","Arts","Sports","University Fest","Workshop"];
export const siteConfig = {
  name: "EventGhar",
  supportEmail: SUPPORT_EMAIL,
  whatsapp: { digits: SUPPORT_WHATSAPP, display: "0332 5727917", url: `https://wa.me/${SUPPORT_WHATSAPP}` },
  instagram: { handle: "eventgharofficial", url: INSTAGRAM_URL },
  navLinks: [
    { label: "Events", href: "/#events" },
    { label: "How it works", href: "/#how-it-works" },
    { label: "Contact", href: "/contact-us" },
  ],
};
