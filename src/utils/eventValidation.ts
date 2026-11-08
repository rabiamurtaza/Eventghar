import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllRows } from "@/utils/fetchAll";

export type TierInput = { name?: string; price?: string | number; total?: string | number };

type EventFormInput = {
  start_date?: string | null;
  end_date?: string | null;
  total_tickets?: string | number | null;
  max_tickets_per_person?: string | number | null;
};

const asText = (v: unknown) => (v === null || v === undefined ? "" : String(v).trim());
const isWholeNumberAbove0 = (v: string) => /^\d+$/.test(v) && Number(v) > 0;
const tierKey = (name?: string) => (asText(name) || "Standard").toLowerCase();

/** Prices may be typed with thousands commas ("1,000"); this turns them into a number. */
export function parsePriceInput(v: unknown): number {
  const n = parseFloat(asText(v).replace(/,/g, ""));
  return isNaN(n) ? 0 : n;
}

/**
 * Checks the event form before saving. Returns a message for the admin, or null if fine.
 * Only catches clear mistakes (nothing a valid event could trip over).
 */
export function validateEventForm(form: EventFormInput, tiers: TierInput[]): string | null {
  const start = asText(form.start_date);
  const end = asText(form.end_date);
  if (start && end && end < start) {
    return "The end date cannot be before the start date.";
  }

  const total = asText(form.total_tickets);
  if (total && !isWholeNumberAbove0(total)) {
    return "Total tickets must be a whole number greater than 0 (or leave it empty for no limit).";
  }

  const perPerson = asText(form.max_tickets_per_person);
  if (perPerson && !isWholeNumberAbove0(perPerson)) {
    return "Max tickets per person must be a whole number greater than 0 (or leave it empty).";
  }

  const seen = new Set<string>();
  for (const tier of tiers) {
    const name = asText(tier.name);
    const price = asText(tier.price);
    const tierTotal = asText(tier.total);
    if (!name && !price && !tierTotal) continue; // an empty row is ignored when saving

    if (price && (isNaN(parseFloat(price.replace(/,/g, ""))) || parseFloat(price.replace(/,/g, "")) < 0)) {
      return `The price "${price}" for ticket type "${name || "Standard"}" is not valid. Use a number like 1500, or 0 for free.`;
    }
    if (tierTotal && !isWholeNumberAbove0(tierTotal)) {
      return `The ticket limit for "${name || "Standard"}" must be a whole number greater than 0 (or leave it empty for no limit).`;
    }

    const key = tierKey(name);
    if (seen.has(key)) {
      return `Two ticket types are both named "${name || "Standard"}". Give each one a different name.`;
    }
    seen.add(key);
  }

  return null;
}

/**
 * Before saving an EDIT, looks at the bookings that already exist for the event and returns
 * warnings if the change would leave them inconsistent (a removed/renamed ticket type, or a
 * limit lower than what is already booked). The admin can still choose to continue.
 */
export async function findEventEditWarnings(
  supabase: SupabaseClient,
  eventId: string,
  newTotalTickets: string | number | null | undefined,
  tiers: TierInput[]
): Promise<string[]> {
  const { data, error } = await fetchAllRows<{ ticket_type: string | null; number_of_tickets: number | null }>((from, to) =>
    supabase
      .from("bookings")
      .select("ticket_type, number_of_tickets")
      .eq("event_id", eventId)
      .in("status", ["pending", "verified", "confirmed"])
      .order("id")
      .range(from, to)
  );
  if (error || data.length === 0) return [];

  const bookedByTier = new Map<string, { label: string; count: number }>();
  let bookedTotal = 0;
  for (const b of data) {
    const count = Number(b.number_of_tickets) || 1;
    bookedTotal += count;
    const label = asText(b.ticket_type) || "Standard";
    const key = label.toLowerCase();
    const entry = bookedByTier.get(key) || { label, count: 0 };
    entry.count += count;
    bookedByTier.set(key, entry);
  }

  const warnings: string[] = [];

  const total = asText(newTotalTickets);
  if (total && isWholeNumberAbove0(total) && Number(total) < bookedTotal) {
    warnings.push(`Total tickets is ${total}, but ${bookedTotal} ticket(s) are already booked for this event.`);
  }

  const newTiers = new Map<string, TierInput>();
  tiers.forEach((t) => {
    if (asText(t.name) || asText(t.price) || asText(t.total)) newTiers.set(tierKey(t.name), t);
  });
  // With no ticket types at all, bookings are not tied to a named type, so nothing to compare.
  if (newTiers.size > 0) {
    bookedByTier.forEach((booked, key) => {
      const tier = newTiers.get(key);
      if (!tier) {
        warnings.push(`Ticket type "${booked.label}" was removed or renamed, but ${booked.count} ticket(s) are already booked under that name.`);
      } else {
        const limit = asText(tier.total);
        if (limit && isWholeNumberAbove0(limit) && Number(limit) < booked.count) {
          warnings.push(`"${booked.label}" is limited to ${limit}, but ${booked.count} ticket(s) are already booked.`);
        }
      }
    });
  }

  return warnings;
}
