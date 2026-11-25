import { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllRows } from "@/utils/fetchAll";

/** The file path inside a Storage bucket, taken from a public URL (or null if it is not one of ours). */
export function storagePathFromUrl(url: unknown, bucket: string): string | null {
  if (typeof url !== "string" || !url) return null;
  const marker = `/object/public/${bucket}/`;
  const at = url.indexOf(marker);
  if (at === -1) return null;
  const raw = url.slice(at + marker.length).split("?")[0].split("#")[0];
  if (!raw) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/** Removes files from a bucket in small groups. Returns how many were removed and how many were asked for. */
async function removeFiles(
  supabase: SupabaseClient,
  bucket: string,
  paths: string[]
): Promise<{ removed: number; asked: number }> {
  const unique = Array.from(new Set(paths));
  let removed = 0;
  for (let i = 0; i < unique.length; i += 100) {
    const chunk = unique.slice(i, i + 100);
    try {
      const { data, error } = await supabase.storage.from(bucket).remove(chunk);
      if (!error && Array.isArray(data)) removed += data.length;
    } catch {
      // a failed clean-up must never undo or block the delete itself
    }
  }
  return { removed, asked: unique.length };
}

/**
 * Permanently deletes an event and all associated dependent data from Supabase:
 * 1. issued_tickets (attendee QR tickets)
 * 2. bookings (ticket booking requests and customer records)
 * 3. ticket_types (pricing tiers for the event)
 * 4. events (the event record itself)
 * 5. AFTER the event is gone: the uploaded files (payment screenshots, student IDs, poster),
 *    so storage space is freed. If a file cannot be removed the event is still deleted and a
 *    `warning` is returned (the worst case is a leftover file, never a broken booking).
 */
export async function deleteEventCascade(
  supabase: SupabaseClient,
  eventId: string | number
): Promise<{ success: boolean; error?: string; warning?: string; filesRemoved?: number }> {
  try {
    // 0. Note down the files that belong to this event BEFORE the rows are deleted.
    //    (If this look-up fails we still delete the event; only the clean-up is skipped.)
    let paymentPaths: string[] = [];
    let studentIdPaths: string[] = [];
    let posterUrl: string | null = null;
    let lookupFailed = false;
    try {
      const fileRows = await fetchAllRows<{ payment_screenshot_url: string | null; student_id_url: string | null }>((from, to) =>
        supabase
          .from("bookings")
          .select("payment_screenshot_url, student_id_url")
          .eq("event_id", eventId)
          .order("id")
          .range(from, to)
      );
      if (fileRows.error) lookupFailed = true;
      for (const row of fileRows.data) {
        const p = storagePathFromUrl(row.payment_screenshot_url, "payment-screenshots");
        if (p) paymentPaths.push(p);
        const s = storagePathFromUrl(row.student_id_url, "student-ids");
        if (s) studentIdPaths.push(s);
      }
      const { data: ev, error: evLookupErr } = await supabase.from("events").select("image_url").eq("id", eventId).maybeSingle();
      if (evLookupErr) lookupFailed = true;
      posterUrl = (ev && (ev as { image_url?: string | null }).image_url) || null;
    } catch {
      lookupFailed = true;
      paymentPaths = [];
      studentIdPaths = [];
      posterUrl = null;
    }

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

    // 5. The event is gone - now free the storage space (never fails the delete)
    let removed = 0;
    let asked = 0;
    try {
      const pay = await removeFiles(supabase, "payment-screenshots", paymentPaths);
      const ids = await removeFiles(supabase, "student-ids", studentIdPaths);
      removed += pay.removed + ids.removed;
      asked += pay.asked + ids.asked;

      // The poster is only removed if no other event is using the same picture.
      const posterPath = storagePathFromUrl(posterUrl, "event-images");
      if (posterPath && posterUrl) {
        const { count, error: sharedErr } = await supabase
          .from("events")
          .select("id", { count: "exact", head: true })
          .eq("image_url", posterUrl);
        if (!sharedErr && (count ?? 0) === 0) {
          const poster = await removeFiles(supabase, "event-images", [posterPath]);
          removed += poster.removed;
          asked += poster.asked;
        }
      }
    } catch (cleanupErr) {
      console.error("Event deleted, but removing its files failed:", cleanupErr);
    }

    const problems: string[] = [];
    if (lookupFailed) problems.push("its uploaded files could not be looked up");
    if (asked > removed) problems.push(`${asked - removed} of ${asked} uploaded file(s) could not be removed`);
    return {
      success: true,
      filesRemoved: removed,
      ...(problems.length ? { warning: `The event was deleted, but ${problems.join(" and ")}. You can remove them in the Supabase dashboard (Storage).` } : {}),
    };
  } catch (err: unknown) {
    console.error("Unexpected error in deleteEventCascade:", err);
    const msg = err instanceof Error ? err.message : "An unexpected error occurred while deleting the event.";
    return { success: false, error: msg };
  }
}
