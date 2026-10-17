import { SupabaseClient } from "@supabase/supabase-js";

export interface TicketQRPayload {
  app: "EVENT_GHAR";
  ticket_code: string;
  ticket_id: string;
  event_id: string;
  event_title?: string;
  ticket_number: number;
  total_tickets: number;
  holder_name: string;
}

/**
 * Generates individual issued_tickets for a verified booking.
 * If tickets are already generated for this booking, returns the existing ones.
 */
export async function generateTicketsForBooking(
  supabase: SupabaseClient,
  booking: {
    id: string;
    event_id: string;
    number_of_tickets: number;
    full_name: string;
    user_email: string;
    phone_number?: string;
    ticket_type?: string;
    events?: {
      title?: string;
      event_number?: number | string;
    };
  }
) {
  // 1. Check if tickets already exist for this booking
  const { data: existingTickets } = await supabase
    .from("issued_tickets")
    .select("*")
    .eq("booking_id", booking.id)
    .order("ticket_number", { ascending: true });

  if (existingTickets && existingTickets.length > 0) {
    return existingTickets;
  }

  // 2. Fetch event details if missing
  let eventNumber = booking.events?.event_number;
  let eventTitle = booking.events?.title;
  if (!eventNumber) {
    const { data: eventData } = await supabase
      .from("events")
      .select("event_number, title")
      .eq("id", booking.event_id)
      .single();
    if (eventData) {
      eventNumber = eventData.event_number;
      eventTitle = eventData.title;
    }
  }

  const count = Math.max(1, booking.number_of_tickets || 1);
  const bookingPrefix = booking.id.replace(/-/g, "").slice(0, 4).toUpperCase();
  const eventPrefix = eventNumber ? String(eventNumber) : "EVT";

  const ticketsToInsert = [];
  for (let i = 1; i <= count; i++) {
    const randomHex = Math.random().toString(36).substring(2, 5).toUpperCase();
    const ticketCode = `EG-${eventPrefix}-${bookingPrefix}${randomHex}-${i}`;

    ticketsToInsert.push({
      booking_id: booking.id,
      event_id: booking.event_id,
      ticket_number: i,
      total_tickets: count,
      ticket_type: booking.ticket_type || "Standard",
      ticket_code: ticketCode,
      holder_name: booking.full_name,
      holder_email: booking.user_email,
      holder_phone: booking.phone_number || "",
      status: "valid",
    });
  }

  const { data: insertedTickets, error } = await supabase
    .from("issued_tickets")
    .insert(ticketsToInsert)
    .select();

  if (error) {
    console.error("Error inserting issued_tickets:", error);
    throw error;
  }

  return insertedTickets || [];
}

/**
 * Builds the standard JSON string encoded inside the QR code.
 */
export function buildQRPayload(ticket: {
  id: string;
  ticket_code: string;
  event_id: string;
  ticket_number: number;
  total_tickets: number;
  holder_name: string;
}, eventTitle?: string): string {
  const payload: TicketQRPayload = {
    app: "EVENT_GHAR",
    ticket_code: ticket.ticket_code,
    ticket_id: ticket.id,
    event_id: ticket.event_id,
    event_title: eventTitle || "Event",
    ticket_number: ticket.ticket_number,
    total_tickets: ticket.total_tickets,
    holder_name: ticket.holder_name,
  };
  return JSON.stringify(payload);
}

/**
 * Synthesizes a pleasant high chime for valid check-ins via Web Audio API.
 */
export function playSuccessChime() {
  if (typeof window === "undefined") return;
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
    osc1.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1); // E5
    osc1.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2); // G5
    gain1.gain.setValueAtTime(0.3, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start();
    osc1.stop(ctx.currentTime + 0.6);
  } catch (e) {
    console.warn("Audio chime failed to play:", e);
  }
}

/**
 * Synthesizes an unpleasant low buzzer for invalid/already-used check-ins.
 */
export function playErrorBuzzer() {
  if (typeof window === "undefined") return;
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(150, ctx.currentTime);
    osc.frequency.setValueAtTime(110, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  } catch (e) {
    console.warn("Audio buzzer failed to play:", e);
  }
}
