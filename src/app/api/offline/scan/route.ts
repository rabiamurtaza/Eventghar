import { scanOfflineQr } from "@/utils/offlineServer";
import { readJson, withUser } from "@/utils/offlineApi";

// Checks the seal of a scanned offline QR, then checks the ticket in (once only).
export async function POST(request: Request) {
  const body = await readJson(request);
  return withUser((supabase) => scanOfflineQr(supabase, { qr: body.qr, expectedEventId: body.eventId }));
}
