/**
 * The real "connection" the Offline panel uses (runs in the browser):
 *  - reading events and numbers, voiding, counting downloads: straight to the database
 *    (the database rules decide who may do what)
 *  - generating, re-downloading, scanning, looking up: through the website's own server
 *    routes, because the secret QR seal can only be made there.
 */
import { createClient } from "@/utils/supabase/client";
import type { LookupResult, OfflineApi, OfflineEvent, OfflineStats } from "@/utils/offlineTypes";

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return handle<T>(res);
}

async function handle<T>(res: Response): Promise<T> {
  let data: { error?: string } | null = null;
  try {
    data = await res.json();
  } catch {}
  if (!res.ok) throw new Error(data?.error || "Something went wrong. Please try again.");
  return data as T;
}

function rpcError(message: string, fallback = "Something went wrong. Please try again."): Error {
  // Our database functions raise plain sentences; anything technical gets a friendly line instead
  return new Error(/permission denied|violates|syntax|column|relation/i.test(message) ? fallback : message || fallback);
}

export function createOfflineApi(): OfflineApi {
  const supabase = createClient();

  return {
    async listEvents(): Promise<OfflineEvent[]> {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Please log in again.");

      const columns =
        "id, title, event_number, status, start_date, end_date, start_time, end_time, venue_name, city, ticket_price, organizer_id, ticket_types(name, price)";
      const { data: admin } = await supabase.from("admins").select("id").eq("id", user.id).maybeSingle();

      let query = supabase.from("events").select(columns).order("created_at", { ascending: false });
      if (!admin) query = query.eq("organizer_id", user.id); // organizers: only their own events
      const { data, error } = await query;
      if (error) throw rpcError(error.message);
      return (data || []) as unknown as OfflineEvent[];
    },

    async stats(eventId) {
      const { data, error } = await supabase.rpc("offline_event_stats", { p_event_id: eventId });
      if (error) throw rpcError(error.message);
      return data as OfflineStats;
    },

    generate: (eventId, ticketType, quantity) => post("/api/offline/generate", { eventId, ticketType, quantity }),

    async getBatch(batchId) {
      return handle(await fetch(`/api/offline/batches/${encodeURIComponent(batchId)}`, { cache: "no-store" }));
    },

    async recordDownload(batchId) {
      const { data, error } = await supabase.rpc("record_offline_download", { p_batch_id: batchId });
      if (error) throw rpcError(error.message);
      return data as { previous_count: number; new_count: number };
    },

    async voidBatch(batchId) {
      const { data, error } = await supabase.rpc("void_offline_batch", { p_batch_id: batchId });
      if (error) throw rpcError(error.message);
      return data as { voided: number; already_used: number };
    },

    async voidTicket(ticketId) {
      const { data, error } = await supabase.rpc("void_offline_ticket", { p_ticket_id: ticketId });
      if (error) throw rpcError(error.message);
      return data as { changed: boolean };
    },

    lookup: (eventId, serial, code, checkIn) => post<LookupResult>("/api/offline/lookup", { eventId, serial, code, checkIn }),
  };
}
