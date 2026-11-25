/**
 * GATE SPEED - the ticket list a scanning device keeps for fast checking. BROWSER ONLY.
 *
 * "Sync Tickets" downloads, in a few big requests, every online pass and every offline (cash)
 * ticket of the person's events. The scanner then recognises tickets from this list instead
 * of asking the database about each one.
 *
 * The list is only a SHORTCUT. The database stays the authority:
 *   - a ticket that is not in the list is simply checked the old way
 *   - a ticket the list says is fine is still admitted by ONE live database check
 *   - the list answers on its own only when the answer can never change
 *     ("already used", "void", "wrong event")
 *
 * Privacy: only what the scanner shows is kept (no emails, no phone numbers). The list is
 * wiped on logout, when there is no login, when it belongs to someone else, and 3 days
 * after it was made.
 */
import { createClient } from "@/utils/supabase/client";
import { fetchAllRows } from "@/utils/fetchAll";
import { parseEventEndDateTime } from "@/utils/eventLifecycle";

export type GateOnlineTicket = {
  id: string;
  event_id: string;
  ticket_code: string | null;
  holder_name: string | null;
  ticket_number: number;
  total_tickets: number;
  ticket_type: string | null;
  status: string;
  scanned_at: string | null;
};

export type GateOfflineTicket = {
  id: string;
  event_id: string;
  batch_id: string;
  serial: number;
  position: number;
  ticket_type: string;
  price: number;
  status: string; // generated | checked_in | void
  checked_in_at: string | null;
};

export type GateSnapshot = {
  version: 1;
  userId: string;
  role: "admin" | "organizer";
  syncedAt: number;
  expiresAt: number;
  events: Record<string, { title: string; syncedAt?: number }>;
  batches: Record<string, { batch_number: number; quantity: number }>;
  online: GateOnlineTicket[];
  offline: GateOfflineTicket[];
};

export type GateSummary = { syncedAt: number; events: number; online: number; offline: number };

const DB_NAME = "eg-gate";
const STORE = "snapshots";
const KEY = "current";
const KEEP_MS = 3 * 24 * 60 * 60 * 1000; // 3 days
const ENDED_GRACE_MS = 24 * 60 * 60 * 1000; // events that ended more than a day ago are skipped
const ID_CHUNK = 40; // event ids per request (keeps the web address short)

// ------------------------------------------------------------------ memory
type Memory = {
  snap: GateSnapshot;
  online: Map<string, GateOnlineTicket>;
  offline: Map<string, GateOfflineTicket>;
};
let memory: Memory | null = null;

function toMemory(snap: GateSnapshot): Memory {
  return {
    snap,
    online: new Map(snap.online.map((t) => [t.id, t])),
    offline: new Map(snap.offline.map((t) => [t.id, t])),
  };
}

// ----------------------------------------------------------------- storage
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("no indexedDB"));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbRun<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T | undefined> {
  const db = await openDb();
  try {
    return await new Promise<T | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = run(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

// A tiny marker so that visitors who never synced are never touched by the cleanup below
const FLAG = "eg_gate_list";
const setFlag = (on: boolean) => {
  try {
    if (on) localStorage.setItem(FLAG, "1");
    else localStorage.removeItem(FLAG);
  } catch {}
};
const hasFlag = () => {
  try {
    return localStorage.getItem(FLAG) === "1";
  } catch {
    return false;
  }
};

async function saveToDisk(snap: GateSnapshot): Promise<void> {
  try {
    await idbRun("readwrite", (s) => s.put(snap, KEY));
    setFlag(true);
  } catch {
    // Storage unavailable (private mode, full): the list still works from memory until the page is closed
  }
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;
function persistSoon() {
  if (!memory || persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    if (memory) void saveToDisk(memory.snap);
  }, 2000);
}

/** Removes the list from memory and from the device. Safe to call at any time. */
export async function clearGateSnapshot(): Promise<void> {
  const hadMemory = memory !== null;
  memory = null;
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  if (!hadMemory && !hasFlag()) return; // nothing was ever saved on this device
  try {
    await idbRun("readwrite", (s) => s.delete(KEY));
  } catch {}
  setFlag(false);
}

function isUsable(snap: unknown, userId: string): snap is GateSnapshot {
  const s = snap as GateSnapshot | null | undefined;
  return !!s && s.version === 1 && s.userId === userId && typeof s.expiresAt === "number" && s.expiresAt > Date.now() && Array.isArray(s.online) && Array.isArray(s.offline);
}

/**
 * Loads the saved list into memory (called when the scanner opens). Returns true if a usable
 * list is ready. A list that belongs to someone else, or is too old, is deleted.
 */
export async function preloadGateSnapshot(): Promise<boolean> {
  try {
    if (memory) return true;
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      await clearGateSnapshot();
      return false;
    }
    if (!hasFlag()) return false; // nothing was ever saved on this device
    const saved = await idbRun<GateSnapshot>("readonly", (s) => s.get(KEY) as IDBRequest<GateSnapshot>);
    if (!saved) return false;
    if (!isUsable(saved, session.user.id)) {
      await clearGateSnapshot();
      return false;
    }
    memory = toMemory(saved);
    return true;
  } catch {
    return false;
  }
}

/** When this event was last synced on this device (events synced before per-event times existed use the list's time). */
function eventSyncedAt(snap: GateSnapshot, eventId: string): number | null {
  const e = snap.events[eventId];
  if (!e) return null;
  return e.syncedAt ?? snap.syncedAt;
}

/** An event's tickets are only used while that event's own sync is less than 3 days old. */
function eventIsFresh(snap: GateSnapshot, eventId: string): boolean {
  const at = eventSyncedAt(snap, eventId);
  return at !== null && at + KEEP_MS > Date.now();
}

/**
 * What is currently held (for the small status line next to the button).
 * With an event id: just that event (null if it was never synced / is too old).
 */
export function getGateSummary(eventId?: string): GateSummary | null {
  if (!memory) return null;
  const s = memory.snap;
  if (s.expiresAt <= Date.now()) return null;
  if (eventId) {
    if (!eventIsFresh(s, eventId)) return null;
    return {
      syncedAt: eventSyncedAt(s, eventId) as number,
      events: 1,
      online: s.online.filter((t) => t.event_id === eventId).length,
      offline: s.offline.filter((t) => t.event_id === eventId).length,
    };
  }
  const fresh = Object.keys(s.events).filter((id) => eventIsFresh(s, id));
  if (fresh.length === 0) return null;
  const freshSet = new Set(fresh);
  return {
    syncedAt: Math.max(...fresh.map((id) => eventSyncedAt(s, id) as number)),
    events: fresh.length,
    online: s.online.filter((t) => freshSet.has(t.event_id)).length,
    offline: s.offline.filter((t) => freshSet.has(t.event_id)).length,
  };
}

// ------------------------------------------------------------------ lookup
export function lookupOnlineTicket(id: string): GateOnlineTicket | null {
  if (!memory || memory.snap.expiresAt <= Date.now()) return null;
  const t = memory.online.get(id);
  return t && eventIsFresh(memory.snap, t.event_id) ? t : null;
}

export function lookupOfflineTicket(id: string): GateOfflineTicket | null {
  if (!memory || memory.snap.expiresAt <= Date.now()) return null;
  const t = memory.offline.get(id);
  return t && eventIsFresh(memory.snap, t.event_id) ? t : null;
}

export function eventTitleOf(eventId: string): string | null {
  return memory?.snap.events[eventId]?.title ?? null;
}

export function batchOf(batchId: string): { batch_number: number; quantity: number } | null {
  return memory?.snap.batches[batchId] ?? null;
}

/** After a successful check-in on this device, remember it so a second scan is refused instantly. */
export function markOnlineUsed(id: string, scannedAtIso: string | null) {
  const t = memory?.online.get(id);
  if (!t) return;
  t.status = "used";
  t.scanned_at = scannedAtIso || new Date().toISOString();
  persistSoon();
}

export function markOfflineCheckedIn(id: string, checkedInAtIso: string | null) {
  const t = memory?.offline.get(id);
  if (!t) return;
  t.status = "checked_in";
  t.checked_in_at = checkedInAtIso || new Date().toISOString();
  persistSoon();
}

// -------------------------------------------------------------------- sync
export type SyncResult = { ok: true; summary: GateSummary } | { ok: false; error: string };

type EventRow = {
  id: string;
  title: string | null;
  event_number?: number | string | null;
  status: string | null;
  start_date: string | null;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
};

/** An event the person can sync (shown in the dropdown next to the Sync Tickets button). */
export type GateEventOption = { id: string; title: string; event_number: number | string | null };

const chunk = <T,>(items: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
};

type Scope =
  | { ok: true; userId: string; role: "admin" | "organizer"; events: EventRow[] }
  | { ok: false; error: string };

/** The events this person may sync: an admin gets every published event, an organizer only their own; ended events are left out. */
async function loadScope(): Promise<Scope> {
  const supabase = createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) return { ok: false, error: "Please log in again, then try again." };

  const { data: admin } = await supabase.from("admins").select("id").eq("id", user.id).maybeSingle();

  let eventQuery = supabase
    .from("events")
    .select("id, title, event_number, status, start_date, end_date, start_time, end_time")
    .eq("status", "published");
  if (!admin) eventQuery = eventQuery.eq("organizer_id", user.id);
  const { data: allEvents, error: eventError } = await eventQuery;
  if (eventError) return { ok: false, error: "Could not load your events. Check the internet and try again." };

  const now = Date.now();
  const events = ((allEvents || []) as EventRow[]).filter((e) => {
    const end = parseEventEndDateTime(e.start_date, e.end_date, e.end_time, e.start_time);
    return !end || end.getTime() + ENDED_GRACE_MS > now;
  });
  return { ok: true, userId: user.id, role: admin ? "admin" : "organizer", events };
}

/** The list for the dropdown next to the button (newest event number first). */
export async function listGateEvents(): Promise<GateEventOption[]> {
  try {
    const scope = await loadScope();
    if (!scope.ok) return [];
    return scope.events
      .map((e) => ({ id: e.id, title: e.title || "Event", event_number: e.event_number ?? null }))
      .sort((a, b) => Number(b.event_number ?? 0) - Number(a.event_number ?? 0));
  } catch {
    return [];
  }
}

/**
 * Downloads the tickets for scanning.
 *  - no event id: EVERY event this person may sync (the whole saved list is replaced)
 *  - an event id: only that event is refreshed; other synced events on this device are kept
 * The saved list is only changed if EVERYTHING downloaded fine.
 */
export async function syncGateTickets(eventId?: string): Promise<SyncResult> {
  try {
    const supabase = createClient();
    const scope = await loadScope();
    if (!scope.ok) return { ok: false, error: scope.error };

    const targets = eventId ? scope.events.filter((e) => e.id === eventId) : scope.events;
    if (eventId && targets.length === 0) {
      return { ok: false, error: "That event cannot be synced (it may have ended or is not published)." };
    }

    const online: GateOnlineTicket[] = [];
    const offline: GateOfflineTicket[] = [];
    const batches: GateSnapshot["batches"] = {};

    // their tickets, a few events per request, in pages of 1,000
    for (const ids of chunk(targets.map((e) => e.id), ID_CHUNK)) {
      const onlineRes = await fetchAllRows<GateOnlineTicket>((from, to) =>
        supabase
          .from("issued_tickets")
          .select("id, event_id, ticket_code, holder_name, ticket_number, total_tickets, ticket_type, status, scanned_at")
          .in("event_id", ids)
          .order("id")
          .range(from, to)
      );
      if (onlineRes.error) return { ok: false, error: "Could not download the online tickets. Check the internet and try again." };
      online.push(...onlineRes.data);

      const offlineRes = await fetchAllRows<{
        id: string;
        event_id: string;
        batch_id: string;
        serial: number;
        position_in_batch: number;
        ticket_type: string;
        price: number | string;
        status: string;
        checked_in_at: string | null;
      }>((from, to) =>
        supabase
          .from("offline_tickets")
          .select("id, event_id, batch_id, serial, position_in_batch, ticket_type, price, status, checked_in_at")
          .in("event_id", ids)
          .order("id")
          .range(from, to)
      );
      if (offlineRes.error) return { ok: false, error: "Could not download the offline tickets. Check the internet and try again." };
      for (const r of offlineRes.data) {
        offline.push({
          id: r.id,
          event_id: r.event_id,
          batch_id: r.batch_id,
          serial: r.serial,
          position: r.position_in_batch,
          ticket_type: r.ticket_type,
          price: Number(r.price) || 0,
          status: r.status,
          checked_in_at: r.checked_in_at,
        });
      }

      const batchRes = await fetchAllRows<{ id: string; batch_number: number; quantity: number }>((from, to) =>
        supabase.from("offline_batches").select("id, batch_number, quantity").in("event_id", ids).order("id").range(from, to)
      );
      if (batchRes.error) return { ok: false, error: "Could not download the offline batches. Check the internet and try again." };
      for (const b of batchRes.data) batches[b.id] = { batch_number: b.batch_number, quantity: b.quantity };
    }

    // Build the new list (only now that everything arrived)
    const now = Date.now();
    const events: GateSnapshot["events"] = Object.fromEntries(targets.map((e) => [e.id, { title: e.title || "Event", syncedAt: now }]));
    let keptOnline: GateOnlineTicket[] = [];
    let keptOffline: GateOfflineTicket[] = [];

    // Syncing ONE event keeps the other events already on this device (if they are still fresh and still in scope)
    const prev = memory && memory.snap.userId === scope.userId && memory.snap.expiresAt > now ? memory.snap : null;
    if (eventId && prev) {
      const inScope = new Set(scope.events.map((e) => e.id));
      for (const id of Object.keys(prev.events)) {
        if (id !== eventId && inScope.has(id) && eventIsFresh(prev, id)) events[id] = prev.events[id];
      }
      keptOnline = prev.online.filter((t) => t.event_id !== eventId && events[t.event_id]);
      keptOffline = prev.offline.filter((t) => t.event_id !== eventId && events[t.event_id]);
      for (const t of keptOffline) {
        const b = prev.batches[t.batch_id];
        if (b && !batches[t.batch_id]) batches[t.batch_id] = b;
      }
    }

    const snap: GateSnapshot = {
      version: 1,
      userId: scope.userId,
      role: scope.role,
      syncedAt: now,
      expiresAt: now + KEEP_MS,
      events,
      batches,
      online: [...keptOnline, ...online],
      offline: [...keptOffline, ...offline],
    };
    memory = toMemory(snap);
    if (persistTimer) {
      clearTimeout(persistTimer);
      persistTimer = null;
    }
    await saveToDisk(snap);

    return {
      ok: true,
      summary: { syncedAt: now, events: targets.length, online: online.length, offline: offline.length },
    };
  } catch {
    return { ok: false, error: "Could not download the tickets. Check the internet and try again." };
  }
}
