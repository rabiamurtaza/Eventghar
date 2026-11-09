/**
 * Shared wrapper for the offline-ticket API routes. SERVER ONLY.
 * It checks the visitor is logged in, runs the work with THEIR Supabase session (so the
 * database rules apply to them), and turns any problem into a clear, friendly message.
 */
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";
import { OfflineSetupError } from "@/utils/offlineQr";
import { OfflineUserError } from "@/utils/offlineServer";

const NO_STORE = { "Cache-Control": "no-store" };

export async function withUser(run: (supabase: SupabaseClient) => Promise<unknown>) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Please log in again." }, { status: 401, headers: NO_STORE });
    }
    const result = await run(supabase);
    return NextResponse.json(result, { headers: NO_STORE });
  } catch (e) {
    if (e instanceof OfflineUserError) {
      return NextResponse.json({ error: e.message }, { status: e.status, headers: NO_STORE });
    }
    if (e instanceof OfflineSetupError) {
      console.error(e.message);
      return NextResponse.json(
        { error: "Offline tickets are not set up yet. Please contact the site admin." },
        { status: 500, headers: NO_STORE }
      );
    }
    console.error("Offline tickets route error:", e);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500, headers: NO_STORE });
  }
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
