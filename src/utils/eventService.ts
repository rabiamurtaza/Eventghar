import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Permanently deletes an event and all associated dependent data from Supabase:
 * 1. issued_tickets (attendee QR tickets)
 * 2. bookings (ticket booking requests and customer records)
 * 3. ticket_types (pricing tiers for the event)
 * 4. events (the event record itself)
 */
export async function deleteEventCascade(
  supabase: SupabaseClient,
  eventId: string | number
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Delete all issued tickets for this event
    const { error: ticketsErr } = await supabase
      .from("issued_tickets")
      .delete()
      .eq("event_id", eventId);

    if (ticketsErr) {
      console.error("Error deleting issued_tickets:", ticketsErr);
      return { success: false, error: `Failed to delete issued tickets: ${ticketsErr.message}` };
    }

    // 2. Delete all bookings for this event
    const { error: bookingsErr } = await supabase
      .from("bookings")
      .delete()
      .eq("event_id", eventId);

    if (bookingsErr) {
      console.error("Error deleting bookings:", bookingsErr);
      return { success: false, error: `Failed to delete bookings: ${bookingsErr.message}` };
    }

    // 3. Delete all ticket tiers/types for this event
    const { error: typesErr } = await supabase
      .from("ticket_types")
      .delete()
      .eq("event_id", eventId);

    if (typesErr) {
      console.error("Error deleting ticket_types:", typesErr);
      return { success: false, error: `Failed to delete ticket types: ${typesErr.message}` };
    }

    // 4. Delete the event record itself
    const { error: eventErr } = await supabase
      .from("events")
      .delete()
      .eq("id", eventId);

    if (eventErr) {
      console.error("Error deleting event:", eventErr);
      return { success: false, error: `Failed to delete event: ${eventErr.message}` };
    }

    return { success: true };
  } catch (err: any) {
    console.error("Unexpected error in deleteEventCascade:", err);
    return { success: false, error: err.message || "An unexpected error occurred while deleting the event." };
  }
}
