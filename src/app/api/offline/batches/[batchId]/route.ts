import { getBatchTickets } from "@/utils/offlineServer";
import { withUser } from "@/utils/offlineApi";

// Rebuilds a saved batch (same tickets, same QR codes) for re-downloading. Creates nothing new.
export async function GET(_request: Request, { params }: { params: Promise<{ batchId: string }> }) {
  const { batchId } = await params;
  return withUser((supabase) => getBatchTickets(supabase, batchId));
}
