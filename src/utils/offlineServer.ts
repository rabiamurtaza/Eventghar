/**
 * OFFLINE TICKETS - the server-side logic behind the three API routes. SERVER ONLY.
 *
 * Every function receives the Supabase client of the LOGGED-IN user, so the database's own
 * rules (who may see / do what) always apply. Nothing about the event, price or ticket type
 * is ever trusted from the browser: the database reads them from the event itself.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { EventInfo, OfflineScanResult, ScanKind, SignedTicket } from "@/utils/offlineTypes";
import {
  assertOfflineConfigured,
  buildOfflineQr,
  isUuid,
  makeCheckCode,
  parseOfflineQr,
  parseSerialInput,
  serialLabel,
  verifyCheckCode,
  verifySeal,
} from "@/utils/offlineQr";

/** An error whose message is safe and friendly to show to the user. */
export class OfflineUserError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "OfflineUserError";
    this.status = status;
  }
}

type DbError = { message: string; code?: string } | null;

/** Our database functions raise plain-English sentences (code P0001); show those as they are. */
function dbError(error: NonNullable<DbError>): OfflineUserError {
  if (error.code === "P0001") return new OfflineUserError(error.message, 400);
  if (error.code === "42501") return new OfflineUserError("You do not have permission to do that.", 403);
  console.error("Offline tickets database error:", error);
  return new OfflineUserError("Something went wrong. Please try again.", 500);
}

type RawTicket = {
  id: string;
  serial: number;
  position: number;
  ticket_type: string;
  price: number | string;
  status: string;
  checked_in_at?: string | null;
};

function sign(eventId: string, t: RawTicket): SignedTicket {
  return {
    id: t.id,
    serial: t.serial,
    serial_label: serialLabel(t.serial),
    position: t.position,
    ticket_type: t.ticket_type,
    price: Number(t.price) || 0,
    status: t.status,
    check_code: makeCheckCode(t.id, eventId),
    qr: buildOfflineQr(t.id, eventId),
  };
}

async function loadEventInfo(supabase: SupabaseClient, eventId: string): Promise<EventInfo | null> {
  const { data } = await supabase
    .from("events")
    .select("id, title, start_date, start_time, venue_name, city")
    .eq("id", eventId)
    .maybeSingle();
  return (data as EventInfo | null) ?? null;
}

// ---------------------------------------------------------------- generate
export async function generateBatch(
  supabase: SupabaseClient,
  input: { eventId: unknown; ticketType: unknown; quantity: unknown }
) {
  // Make sure tickets can be sealed BEFORE creating any, so a missing key never leaves
  // half-made tickets behind.
  assertOfflineConfigured();

  if (!isUuid(input.eventId)) throw new OfflineUserError("Please choose an event.");
  const ticketType = String(input.ticketType ?? "").trim();
  if (!ticketType || ticketType.length > 100) throw new OfflineUserError("Please choose a ticket type.");
  const quantity = Number(input.quantity);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 200) {
    throw new OfflineUserError("Please choose between 1 and 200 tickets for one batch.");
  }

  const { data, error } = await supabase.rpc("generate_offline_batch", {
    p_event_id: input.eventId,
    p_ticket_type: ticketType,
    p_quantity: quantity,
  });
  if (error) throw dbError(error);

  const eventId = input.eventId;
  return {
    batch: data.batch,
    event: await loadEventInfo(supabase, eventId),
    tickets: (data.tickets as RawTicket[]).map((t) => sign(eventId, t)),
  };
}

// ------------------------------------------------- re-download (same QR codes)
export async function getBatchTickets(supabase: SupabaseClient, batchId: unknown) {
  if (!isUuid(batchId)) throw new OfflineUserError("That batch could not be found.", 404);

  const { data: batch } = await supabase.from("offline_batches").select("*").eq("id", batchId).maybeSingle();
  // The database rules hide other organizers' batches, so they look like they do not exist
  if (!batch) throw new OfflineUserError("That batch could not be found.", 404);

  const { data: rows, error } = await supabase
    .from("offline_tickets")
    .select("id, serial, position_in_batch, ticket_type, price, status, checked_in_at")
    .eq("batch_id", batchId)
    .order("serial", { ascending: true });
  if (error) throw dbError(error);

  const eventId = batch.event_id as string;
  const tickets = (rows || []).map((r: { position_in_batch: number } & Omit<RawTicket, "position">) =>
    sign(eventId, { ...r, position: r.position_in_batch })
  );
  return { batch, event: await loadEventInfo(supabase, eventId), tickets };
}

// -------------------------------------------------------------------- scan
type ScanResultKind = ScanKind;

const SCAN_MESSAGES: Record<ScanResultKind, string> = {
  valid: "VALID ENTRY (Admitted)",
  already_used: "ALREADY USED",
  void: "VOID TICKET - this ticket was cancelled",
  invalid: "INVALID TICKET",
  wrong_event: "WRONG EVENT",
};

type CheckInRow = {
  result: ScanResultKind | "unauthorized";
  event_title?: string;
  serial?: number;
  position?: number;
  batch_number?: number;
  batch_quantity?: number;
  ticket_type?: string;
  price?: number | string;
  checked_in_at?: string | null;
};

function toScanResult(row: CheckInRow): OfflineScanResult {
  const kind: ScanResultKind = row.result === "unauthorized" ? "invalid" : row.result;
  const result: OfflineScanResult = { result: kind, message: SCAN_MESSAGES[kind] };
  if (row.serial !== undefined) {
    result.details = {
      serial_label: serialLabel(row.serial),
      position: row.position ?? 0,
      batch_number: row.batch_number ?? 0,
      batch_quantity: row.batch_quantity ?? 0,
      ticket_type: row.ticket_type ?? "",
      price: Number(row.price) || 0,
      event_title: row.event_title ?? "",
      checked_in_at: row.checked_in_at ?? null,
    };
  }
  if (kind === "wrong_event" && row.event_title) {
    result.message = `WRONG EVENT - this ticket is for "${row.event_title}"`;
  }
  if (kind === "already_used" && row.checked_in_at) {
    const time = new Date(row.checked_in_at).toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZone: "Asia/Karachi",
    });
    result.message = `ALREADY USED - scanned at ${time}`;
  }
  return result;
}

export async function scanOfflineQr(
  supabase: SupabaseClient,
  input: { qr: unknown; expectedEventId?: unknown }
): Promise<OfflineScanResult> {
  const parsed = parseOfflineQr(input.qr);
  if (!parsed) return { result: "invalid", message: SCAN_MESSAGES.invalid };

  const expected = isUuid(input.expectedEventId) ? input.expectedEventId : null;

  // Read-only: which event does this ticket belong to? (The database rules only show tickets
  // of events this person manages; anything else looks like a ticket that does not exist.)
  const { data: row } = await supabase
    .from("offline_tickets")
    .select("event_id")
    .eq("id", parsed.ticketId)
    .maybeSingle();
  if (!row) return { result: "invalid", message: SCAN_MESSAGES.invalid };

  // The seal is checked BEFORE anything is changed. A changed letter or an invented ticket fails here.
  if (!verifySeal(parsed.ticketId, row.event_id as string, parsed.seal)) {
    return { result: "invalid", message: SCAN_MESSAGES.invalid };
  }

  // One single database update; it only works if the ticket is still "generated"
  const { data, error } = await supabase.rpc("check_in_offline_ticket", {
    p_ticket_id: parsed.ticketId,
    p_expected_event_id: expected,
  });
  if (error) throw dbError(error);
  return toScanResult(data as CheckInRow);
}

// ------------------------------------------------------- look up by serial
export async function lookupBySerial(
  supabase: SupabaseClient,
  input: { eventId: unknown; serial: unknown; code: unknown; checkIn?: unknown }
) {
  if (!isUuid(input.eventId)) throw new OfflineUserError("Please choose an event.");
  const serial = parseSerialInput(input.serial);
  if (serial === null) throw new OfflineUserError("Please type the serial number, for example OFF-0007.");

  const { data, error } = await supabase.rpc("find_offline_ticket", {
    p_event_id: input.eventId,
    p_serial: serial,
  });
  if (error) throw dbError(error);

  // Without the right check code, say nothing about whether the ticket exists
  const noMatch = { found: false as const, message: "No ticket matches that serial number and check code." };
  if (!data?.found) return noMatch;
  if (!verifyCheckCode(data.id, data.event_id, input.code)) return noMatch;

  const ticket = {
    serial_label: serialLabel(data.serial),
    position: data.position as number,
    batch_number: data.batch_number as number,
    batch_quantity: data.batch_quantity as number,
    ticket_type: data.ticket_type as string,
    price: Number(data.price) || 0,
    status: data.status as string,
    event_title: data.event_title as string,
    generated_at: data.generated_at as string,
    generated_by: data.generated_by as string,
    checked_in_at: (data.checked_in_at as string | null) ?? null,
  };

  if (input.checkIn === true) {
    const { data: ci, error: ciError } = await supabase.rpc("check_in_offline_ticket", {
      p_ticket_id: data.id,
      p_expected_event_id: input.eventId,
    });
    if (ciError) throw dbError(ciError);
    return { found: true as const, ticket, checkIn: toScanResult(ci as CheckInRow) };
  }
  return { found: true as const, ticket };
}
