import { lookupBySerial } from "@/utils/offlineServer";
import { readJson, withUser } from "@/utils/offlineApi";

// "Check a ticket": finds a ticket by serial number + check code (and can check it in).
export async function POST(request: Request) {
  const body = await readJson(request);
  return withUser((supabase) =>
    lookupBySerial(supabase, {
      eventId: body.eventId,
      serial: body.serial,
      code: body.code,
      checkIn: body.checkIn === true,
    })
  );
}
