import { SupabaseClient } from "@supabase/supabase-js";
import { generateTicketsForBooking } from "@/utils/ticketService";

type BookingLike = {
  id: string;
  event_id: string;
  status?: string;
  number_of_tickets: number;
  full_name: string;
  user_email: string;
  phone_number?: string;
  ticket_type?: string;
  events?: unknown;
};

export type BookingActionResult = { ok: true; warning?: string } | { ok: false; error: string };

const ACTIVE_STATUSES = ["verified", "confirmed"];

function parseTiers(raw: unknown): Array<{ name?: string; total?: string | number }> {
  if (!raw) return [];
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Checks whether verifying this booking would exceed the event's overall capacity
 * or the capacity of the booking's ticket tier. Returns a human-readable problem, or null.
 */
async function findCapacityProblem(supabase: SupabaseClient, booking: BookingLike): Promise<string | null> {
  const qty = Math.max(1, Number(booking.number_of_tickets) || 1);
  const tierName = booking.ticket_type || "Standard";

  const [{ data: event }, { data: verified }] = await Promise.all([
    supabase.from("events").select("total_tickets, ticket_price").eq("id", booking.event_id).maybeSingle(),
    supabase
      .from("bookings")
      .select("id, ticket_type, number_of_tickets")
      .eq("event_id", booking.event_id)
      .in("status", ACTIVE_STATUSES),
  ]);

  const others = (verified || []).filter((b: { id: string }) => b.id !== booking.id);
  const verifiedTotal = others.reduce((sum: number, b: { number_of_tickets: number }) => sum + (Number(b.number_of_tickets) || 1), 0);
  const verifiedTier = others
    .filter((b: { ticket_type?: string }) => (b.ticket_type || "Standard") === tierName)
    .reduce((sum: number, b: { number_of_tickets: number }) => sum + (Number(b.number_of_tickets) || 1), 0);

  const capacity = Number(event?.total_tickets) || 0;
  if (capacity > 0 && verifiedTotal + qty > capacity) {
    return `Event capacity is ${capacity}. ${verifiedTotal} ticket(s) are already verified, so verifying ${qty} more would exceed it by ${verifiedTotal + qty - capacity}.`;
  }

  let tiers = parseTiers(event?.ticket_price);
  if (tiers.length === 0) {
    const { data: tt } = await supabase.from("ticket_types").select("name, total_available").eq("event_id", booking.event_id);
    tiers = (tt || []).map((t: { name?: string; total_available?: number }) => ({ name: t.name || "Standard", total: t.total_available }));
  }
  const tier = tiers.find((t) => (t.name || "Standard") === tierName);
  const tierLimit = tier && tier.total ? Number(tier.total) : 0;
  if (tierLimit > 0 && verifiedTier + qty > tierLimit) {
    return `"${tierName}" tickets are limited to ${tierLimit}. ${verifiedTier} are already verified, so verifying ${qty} more would exceed it by ${verifiedTier + qty - tierLimit}.`;
  }

  return null;
}

/**
 * Verifies a booking safely:
 *  1. Warns (and asks) if it would exceed capacity.
 *  2. Marks the booking verified and confirms the database accepted the change.
 *  3. Generates QR tickets (or re-activates tickets cancelled by an earlier rejection).
 *  4. If ticket generation fails, puts the booking back to its previous status so it can be retried.
 */
export async function verifyBooking(
  supabase: SupabaseClient,
  booking: BookingLike,
  confirmOverCapacity: (message: string) => boolean
): Promise<BookingActionResult> {
  try {
    const problem = await findCapacityProblem(supabase, booking);
    if (problem && !confirmOverCapacity(`${problem}\n\nVerify anyway?`)) {
      return { ok: false, error: "Verification cancelled (capacity limit)." };
    }

    const previousStatus = booking.status || "pending";
    const { data: updated, error: updateErr } = await supabase
      .from("bookings")
      .update({ status: "verified" })
      .eq("id", booking.id)
      .select("id");

    if (updateErr) return { ok: false, error: `Could not verify booking: ${updateErr.message}` };
    if (!updated || updated.length === 0) {
      return { ok: false, error: "Could not verify booking: the database did not accept the change (permission denied)." };
    }

    try {
      await generateTicketsForBooking(supabase, booking as Parameters<typeof generateTicketsForBooking>[1]);
      // Re-activate tickets if this booking was previously rejected and its tickets were cancelled
      await supabase.from("issued_tickets").update({ status: "valid" }).eq("booking_id", booking.id).eq("status", "cancelled");
    } catch (genErr: unknown) {
      await supabase.from("bookings").update({ status: previousStatus }).eq("id", booking.id);
      const msg = genErr instanceof Error ? genErr.message : String((genErr as { message?: string })?.message || genErr);
      return {
        ok: false,
        error: `QR tickets could not be created, so the booking was set back to "${previousStatus}". Please try Verify again.\n\nDetails: ${msg}`,
      };
    }

    return { ok: true };
  } catch (err: unknown) {
    return { ok: false, error: err instanceof Error ? err.message : "Unexpected error while verifying booking." };
  }
}

/**
 * Rejects a booking and cancels any QR tickets already issued for it,
 * so they can no longer be used at the gate.
 */
export async function rejectBooking(supabase: SupabaseClient, booking: BookingLike): Promise<BookingActionResult> {
  try {
    const { data: updated, error: updateErr } = await supabase
      .from("bookings")
      .update({ status: "rejected" })
      .eq("id", booking.id)
      .select("id");

    if (updateErr) return { ok: false, error: `Could not reject booking: ${updateErr.message}` };
    if (!updated || updated.length === 0) {
      return { ok: false, error: "Could not reject booking: the database did not accept the change (permission denied)." };
    }

    const { error: cancelErr } = await supabase
      .from("issued_tickets")
      .update({ status: "cancelled" })
      .eq("booking_id", booking.id)
      .eq("status", "valid");

    if (cancelErr) {
      return {
        ok: true,
        warning: `Booking rejected, but its QR tickets could not be cancelled (${cancelErr.message}). The gate scanner will still refuse them because the booking is rejected.`,
      };
    }
    return { ok: true };
  } catch (err: unknown) {
    return { ok: false, error: err instanceof Error ? err.message : "Unexpected error while rejecting booking." };
  }
}
