/**
 * GATE SPEED - the fast scan decisions. BROWSER ONLY.
 *
 * Both functions return "not handled" whenever they are not 100% sure, and the scanner then
 * runs its original step-by-step check, exactly as before. They never refuse a ticket on
 * information that could have changed (only "already used", "void" and "wrong event", which
 * can never change, are answered from the list).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  batchOf,
  eventTitleOf,
  lookupOfflineTicket,
  lookupOnlineTicket,
  markOnlineUsed,
} from "@/utils/gateCache";

/** Shown whenever a ticket could not be checked because the phone has no working internet. */
export const NO_INTERNET_MESSAGE = "No internet - ticket not checked. Check your internet, then scan again.";

/** True if the browser already knows the phone is offline (answers instantly, no waiting). */
export function deviceIsOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

/** Did a Supabase call fail because it could not reach the server (as opposed to a database answer)? */
export function looksLikeNetworkError(error: { message?: string; code?: string } | null | undefined): boolean {
  if (!error) return false;
  if (!error.code) return true; // database answers always carry a code; a failed connection has none
  return /failed to fetch|network|load failed|fetch failed|timed? ?out|aborted|offline/i.test(error.message || "");
}

// --------------------------------------------------------------------------- online
export type FastOnlineOutcome =
  | { handled: false }
  | {
      handled: true;
      type: "success" | "wrong_event" | "already_used" | "invalid";
      message: string;
      success?: boolean;
      details?: {
        holder_name?: string;
        ticket_code?: string;
        ticket_number?: number;
        total_tickets?: number;
        ticket_type?: string;
        event_title?: string;
        scanned_at?: string;
      };
    };

type RpcRow = {
  result: string;
  status?: string;
  booking_status?: string;
  event_title?: string;
  holder_name?: string;
  ticket_code?: string;
  ticket_number?: number;
  total_tickets?: number;
  ticket_type?: string;
  scanned_at?: string | null;
};

const timeOnly = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "earlier";

/**
 * Online (website) ticket. Returns handled:false to let the original check run.
 */
export async function fastOnlineCheck(
  supabase: SupabaseClient,
  args: { ticketId: string; ticketCode?: string; selectedEventId: string; activeEventName: string }
): Promise<FastOnlineOutcome> {
  const cached = lookupOnlineTicket(args.ticketId);
  if (!cached) return { handled: false };
  // The code inside the QR must match the list, exactly like the original check demands
  if (args.ticketCode && cached.ticket_code && args.ticketCode !== cached.ticket_code) return { handled: false };

  const eventTitle = eventTitleOf(cached.event_id) || undefined;
  const base = {
    holder_name: cached.holder_name || undefined,
    ticket_code: cached.ticket_code || undefined,
    ticket_number: cached.ticket_number,
    total_tickets: cached.total_tickets,
    ticket_type: cached.ticket_type || undefined,
    event_title: eventTitle,
  };

  // Wrong event: a ticket never changes event, so this is answered at once
  if (args.selectedEventId && cached.event_id !== args.selectedEventId) {
    return {
      handled: true,
      type: "wrong_event",
      message: `Wrong Event! This ticket belongs to "${eventTitle || "Another Event"}", not "${args.activeEventName}".`,
      details: { ...base, scanned_at: cached.scanned_at || undefined },
    };
  }

  // Already used: a used ticket never becomes valid again, so this is answered at once
  if (cached.status === "used" || cached.status === "scanned") {
    return {
      handled: true,
      type: "already_used",
      message: `Ticket Already Used! Scanned at ${timeOnly(cached.scanned_at)}.`,
      details: { ...base, scanned_at: cached.scanned_at || undefined },
    };
  }

  // Anything other than "valid" (cancelled, expired...) could have changed: let the original check ask the database
  if (cached.status !== "valid") return { handled: false };

  // Looks valid: admit only after ONE live database check (ticket + booking + mark used, atomically)
  if (deviceIsOffline()) {
    return { handled: true, type: "invalid", message: NO_INTERNET_MESSAGE, details: base };
  }

  const { data, error } = await supabase.rpc("check_in_issued_ticket", {
    p_ticket_id: args.ticketId,
    p_expected_event_id: args.selectedEventId || null,
  });

  if (error) {
    if (looksLikeNetworkError(error)) {
      return { handled: true, type: "invalid", message: NO_INTERNET_MESSAGE, details: base };
    }
    // The database answered with an error (for example the new function is not installed yet):
    // nothing was changed, so the original check takes over
    return { handled: false };
  }

  const row = data as RpcRow | null;
  if (!row || typeof row.result !== "string") return { handled: false };

  const details = {
    holder_name: row.holder_name ?? base.holder_name,
    ticket_code: row.ticket_code ?? base.ticket_code,
    ticket_number: row.ticket_number ?? base.ticket_number,
    total_tickets: row.total_tickets ?? base.total_tickets,
    ticket_type: row.ticket_type ?? base.ticket_type,
    event_title: row.event_title ?? base.event_title,
    scanned_at: row.scanned_at || undefined,
  };

  switch (row.result) {
    case "valid":
      markOnlineUsed(args.ticketId, row.scanned_at || null);
      return { handled: true, type: "success", message: "VALID ENTRY (Admitted)", success: true, details };
    case "already_used":
      markOnlineUsed(args.ticketId, row.scanned_at || null);
      return { handled: true, type: "already_used", message: `Ticket Already Used! Scanned at ${timeOnly(row.scanned_at)}.`, details };
    case "wrong_event":
      return {
        handled: true,
        type: "wrong_event",
        message: `Wrong Event! This ticket belongs to "${row.event_title || "Another Event"}", not "${args.activeEventName}".`,
        details,
      };
    case "invalid_status":
      return {
        handled: true,
        type: "invalid",
        message: `Ticket is ${String(row.status).toUpperCase()} and cannot be used for entry.`,
        details,
      };
    case "booking_not_active":
      return {
        handled: true,
        type: "invalid",
        message: `Booking is ${String(row.booking_status).toUpperCase()} - this ticket is not valid for entry.`,
        details,
      };
    case "not_recorded":
      return {
        handled: true,
        type: "invalid",
        message: "Entry NOT recorded - the database did not accept the check-in (permission problem). Do NOT admit; contact the admin.",
        details,
      };
    default:
      // "not_found" or anything unexpected: the original check explains it properly
      return { handled: false };
  }
}

// -------------------------------------------------------------------------- offline
const OFFLINE_QR_RE = /^OFF\.([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.[A-Za-z0-9_-]{22}$/;

/** The ticket id inside an offline QR ("OFF.<id>.<seal>"), or null. (The seal is checked by the server.) */
export function parseOfflineTicketId(qr: string): string | null {
  const m = qr.trim().match(OFFLINE_QR_RE);
  return m ? m[1] : null;
}

export type FastOfflineOutcome =
  | { kind: "none" }
  | { kind: "live"; eventId: string }
  | {
      kind: "instant";
      type: "wrong_event" | "already_used" | "void";
      message: string;
      offline: {
        serial_label: string;
        batch_number: number;
        batch_quantity: number;
        position: number;
        price: number;
        ticket_type: string;
        event_title: string;
      };
    };

/**
 * Offline (printed) ticket, decided from the list without any request:
 *   - "instant": wrong event / already used / void (these can never change)
 *   - "live": looks fine; the server must still check the seal and check it in (the event id is
 *     passed along so the server can skip one lookup)
 *   - "none": not in the list; the original check runs
 */
export function fastOfflineLookup(qr: string, selectedEventId: string): FastOfflineOutcome {
  const id = parseOfflineTicketId(qr);
  if (!id) return { kind: "none" };
  const t = lookupOfflineTicket(id);
  if (!t) return { kind: "none" };

  const eventTitle = eventTitleOf(t.event_id) || "";
  const batch = batchOf(t.batch_id);
  const offline = {
    serial_label: `OFF-${String(t.serial).padStart(4, "0")}`,
    batch_number: batch?.batch_number ?? 0,
    batch_quantity: batch?.quantity ?? 0,
    position: t.position,
    price: t.price,
    ticket_type: t.ticket_type,
    event_title: eventTitle,
  };

  if (selectedEventId && t.event_id !== selectedEventId) {
    return {
      kind: "instant",
      type: "wrong_event",
      message: eventTitle ? `WRONG EVENT - this ticket is for "${eventTitle}"` : "WRONG EVENT",
      offline,
    };
  }
  if (t.status === "checked_in") {
    const time = t.checked_in_at
      ? new Date(t.checked_in_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Karachi" })
      : "";
    return { kind: "instant", type: "already_used", message: time ? `ALREADY USED - scanned at ${time}` : "ALREADY USED", offline };
  }
  if (t.status === "void") {
    return { kind: "instant", type: "void", message: "VOID TICKET - this ticket was cancelled", offline };
  }
  if (t.status === "generated") return { kind: "live", eventId: t.event_id };
  return { kind: "none" };
}
