import type { OfflineEvent } from "@/utils/offlineTypes";
import { parsePriceInput } from "@/utils/eventValidation";

export type Tier = { name: string; price: number };

/**
 * The ticket types of an event with their prices, in the same order the website uses:
 * the tiers saved on the event first, then the ticket_types table as a fallback.
 * (The database re-reads the real price itself when tickets are generated.)
 */
export function getEventTiers(event: OfflineEvent | null | undefined): Tier[] {
  if (!event) return [];
  let tiers: Array<{ name?: unknown; price?: unknown }> = [];
  try {
    const raw = typeof event.ticket_price === "string" ? JSON.parse(event.ticket_price) : event.ticket_price;
    if (Array.isArray(raw)) tiers = raw;
  } catch {}
  if (tiers.length === 0 && Array.isArray(event.ticket_types)) tiers = event.ticket_types;
  const list = tiers
    .filter((t) => t && typeof t === "object")
    .map((t) => ({ name: String(t.name ?? "").trim() || "Standard", price: parsePriceInput(t.price) }));
  return list.length > 0 ? list : [{ name: "Standard", price: 0 }];
}
