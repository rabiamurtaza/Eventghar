/**
 * Works out the price of a booking from the event's ticket types:
 *   unit price of the booked ticket type × number of tickets.
 * Uses the event's current ticket prices (stored on the event).
 */

type EventPricing = {
  ticket_price?: unknown;
  ticket_types?: Array<{ name?: string | null; price?: number | string | null }> | null;
} | null | undefined;

type BookingForPrice = {
  ticket_type?: string | null;
  number_of_tickets?: number | string | null;
  events?: EventPricing | EventPricing[];
};

const toNumber = (p: unknown) => parseFloat(String(p ?? "").replace(/,/g, ""));

function tiersOf(evt: EventPricing): Array<{ name: string; price: number }> {
  if (!evt) return [];
  let tiers: Array<{ name?: string | null; price?: unknown }> = [];
  try {
    const raw = typeof evt.ticket_price === "string" ? JSON.parse(evt.ticket_price) : evt.ticket_price;
    if (Array.isArray(raw)) tiers = raw;
  } catch {}
  if (tiers.length === 0 && Array.isArray(evt.ticket_types)) tiers = evt.ticket_types;
  return tiers
    .map((t) => ({ name: t.name || "Standard", price: toNumber(t.price) }))
    .filter((t) => !isNaN(t.price));
}

export function getBookingPrice(booking: BookingForPrice): { unitPrice: number | null; quantity: number; total: number | null } {
  const evt = Array.isArray(booking.events) ? booking.events[0] : booking.events;
  const quantity = Math.max(1, Number(booking.number_of_tickets) || 1);
  const typeName = booking.ticket_type || "Standard";
  const tier = tiersOf(evt).find((t) => t.name === typeName);
  if (!tier) return { unitPrice: null, quantity, total: null };
  return { unitPrice: tier.price, quantity, total: tier.price * quantity };
}

export function formatRs(amount: number | null): string {
  if (amount === null) return "—";
  return amount === 0 ? "Free" : `Rs. ${amount.toLocaleString()}`;
}
