import { siteConfig } from "@/config/site";

/**
 * What a blocked person is told when they try to send a new booking (kept short on purpose).
 * The support contact comes from the site settings (src/config/site.ts).
 */
export function blockedBookingMessage(): string {
  return (
    "Your account is blocked from making new bookings because of fake payment screenshots. " +
    "Your existing tickets are not affected. " +
    `Please contact support: ${siteConfig.supportEmail} or WhatsApp ${siteConfig.whatsapp.display}.`
  );
}

/** True if a database error is the "this account is blocked" refusal. */
export function isBlockedError(message: unknown): boolean {
  return typeof message === "string" && /blocked from making new bookings/i.test(message);
}
