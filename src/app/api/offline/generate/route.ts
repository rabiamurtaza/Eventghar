import { generateBatch } from "@/utils/offlineServer";
import { readJson, withUser } from "@/utils/offlineApi";

// Creates a batch of offline tickets and returns them with their sealed QR codes.
export async function POST(request: Request) {
  const body = await readJson(request);
  return withUser((supabase) =>
    generateBatch(supabase, { eventId: body.eventId, ticketType: body.ticketType, quantity: body.quantity })
  );
}
