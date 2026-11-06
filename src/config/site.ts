/**
 * Site-wide settings in ONE place.
 * Change contact details, social links, cities or categories here and they update everywhere.
 * Contact values can also be overridden with environment variables in Vercel.
 */

// Support contact
export const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@eventghar.pk";
// WhatsApp number in international format without "+" (used for wa.me links)
export const SUPPORT_WHATSAPP = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP || "923325727917";

// Social links (leave empty to hide the icon)
export const INSTAGRAM_URL = process.env.NEXT_PUBLIC_INSTAGRAM_URL || "";

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
