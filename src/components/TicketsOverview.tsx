"use client";

import { useMemo, useState } from "react";

type OverviewEvent = {
  id: string;
  title?: string;
  event_number?: number | string | null;
  total_tickets?: number | string | null;
  ticket_price?: unknown;
  ticket_types?: Array<{ name?: string | null; total_available?: number | null }> | null;
};

type OverviewBooking = {
  event_id: string;
  ticket_type?: string | null;
  number_of_tickets?: number | string | null;
  status?: string | null;
  events?: { title?: string; event_number?: number | string | null } | null;
};

interface TicketsOverviewProps {
  events: OverviewEvent[];
  bookings: OverviewBooking[];
  /** Heading shown above the panel */
  title?: string;
}

const qty = (b: OverviewBooking) => Math.max(1, Number(b.number_of_tickets) || 1);
const isVerified = (b: OverviewBooking) => b.status === "verified" || b.status === "confirmed";
const isPending = (b: OverviewBooking) => b.status === "pending";

function parseTiers(evt: OverviewEvent): Array<{ name: string; total: number | null }> {
  let tiers: Array<{ name?: string; total?: unknown }> = [];
  try {
    const raw = typeof evt.ticket_price === "string" ? JSON.parse(evt.ticket_price) : evt.ticket_price;
    if (Array.isArray(raw)) tiers = raw;
  } catch {}
  if (tiers.length === 0 && Array.isArray(evt.ticket_types)) {
    tiers = evt.ticket_types.map((t) => ({ name: t.name || "Standard", total: t.total_available }));
  }
  return tiers
    .filter((t) => t && (t.name || t.total))
    .map((t) => {
      const total = Number(t.total);
      return { name: t.name || "Standard", total: total > 0 ? total : null };
    });
}

function summarize(list: OverviewBooking[]) {
  return {
    verified: list.filter(isVerified).reduce((s, b) => s + qty(b), 0),
    pending: list.filter(isPending).reduce((s, b) => s + qty(b), 0),
    rejected: list.filter((b) => b.status === "rejected").reduce((s, b) => s + qty(b), 0),
    verifiedBookings: list.filter(isVerified).length,
    pendingBookings: list.filter(isPending).length,
  };
}

function eventLabel(e: OverviewEvent) {
  return `${e.event_number ? `#${e.event_number} - ` : ""}${e.title || "Untitled Event"}`;
}

function Bar({ verified, pending, capacity }: { verified: number; pending: number; capacity: number | null }) {
  if (!capacity) return <span className="text-[11px] text-neutral-400">No capacity set</span>;
  const vPct = Math.min(100, (verified / capacity) * 100);
  const pPct = Math.min(100 - vPct, (pending / capacity) * 100);
  return (
    <div className="h-2 w-full rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden flex" aria-hidden="true">
      <div className="h-full bg-green-500" style={{ width: `${vPct}%` }} />
      <div className="h-full bg-amber-400" style={{ width: `${pPct}%` }} />
    </div>
  );
}

export default function TicketsOverview({ events, bookings, title = "Tickets Overview" }: TicketsOverviewProps) {
  const [selectedEventId, setSelectedEventId] = useState<string>("All");

  const rows = useMemo(() => {
    // Include every event that has bookings, even if it isn't in the events list (e.g. drafts)
    const known = new Map(events.map((e) => [e.id, e]));
    bookings.forEach((b) => {
      if (b.event_id && !known.has(b.event_id)) {
        known.set(b.event_id, { id: b.event_id, title: b.events?.title || "Event", event_number: b.events?.event_number });
      }
    });

    return Array.from(known.values()).map((evt) => {
      const evtBookings = bookings.filter((b) => b.event_id === evt.id);
      const overallCap = Number(evt.total_tickets) > 0 ? Number(evt.total_tickets) : null;
      const parsedTiers = parseTiers(evt);
      // If every ticket type has a limit, the event can never sell more than their sum
      const tierSum = parsedTiers.length > 0 && parsedTiers.every((t) => t.total !== null)
        ? parsedTiers.reduce((s, t) => s + (t.total || 0), 0)
        : null;
      // Real capacity = the smaller of "Overall Event Capacity" and the ticket types' total
      const caps = [overallCap, tierSum].filter((c): c is number => c !== null);
      const cap = caps.length > 0 ? Math.min(...caps) : null;
      const capNote = overallCap !== null && tierSum !== null && overallCap !== tierSum
        ? `Overall capacity ${overallCap} · ticket types total ${tierSum}`
        : undefined;
      const s = summarize(evtBookings);
      const tiers = parsedTiers.map((t) => {
        const tierBookings = evtBookings.filter((b) => (b.ticket_type || "Standard") === t.name);
        return { ...t, ...summarize(tierBookings) };
      });
      // Bookings whose ticket type doesn't match any current tier (e.g. a tier was renamed)
      const tierNames = new Set(tiers.map((t) => t.name));
      const unmatched = summarize(evtBookings.filter((b) => !tierNames.has(b.ticket_type || "Standard")));
      return { evt, cap, capNote, ...s, tiers, unmatched };
    });
  }, [events, bookings]);

  const visibleRows = selectedEventId === "All" ? rows : rows.filter((r) => r.evt.id === selectedEventId);
  const selected = selectedEventId === "All" ? null : visibleRows[0];

  return (
    <div className="mb-8 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 sm:p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-extrabold text-neutral-900 dark:text-white">{title}</h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Counts real tickets (a booking of 5 = 5 tickets). Capacity = the smaller of Overall Event Capacity and the ticket types&apos; total. Remaining = capacity − verified − pending.
          </p>
        </div>
        <select
          value={selectedEventId}
          onChange={(e) => setSelectedEventId(e.target.value)}
          className="w-full sm:w-72 rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
        >
          <option value="All">All events</option>
          {rows.map((r) => (
            <option key={r.evt.id} value={r.evt.id}>{eventLabel(r.evt)}</option>
          ))}
        </select>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-neutral-500 py-4 text-center">No events yet.</p>
      ) : (
        <>
          {/* Single event: big number cards */}
          {selected && (
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
              {[
                { label: "Capacity", value: selected.cap ?? "—", sub: selected.capNote, cls: "text-neutral-900 dark:text-white" },
                { label: "Verified tickets", value: selected.verified, sub: `${selected.verifiedBookings} booking(s)`, cls: "text-green-600 dark:text-green-400" },
                { label: "Pending tickets", value: selected.pending, sub: `${selected.pendingBookings} booking(s)`, cls: "text-amber-600 dark:text-amber-400" },
                {
                  label: "Remaining",
                  value: selected.cap !== null ? Math.max(0, selected.cap - selected.verified - selected.pending) : "—",
                  sub: selected.cap !== null && selected.verified + selected.pending > selected.cap ? `Over by ${selected.verified + selected.pending - selected.cap}` : undefined,
                  cls: "text-indigo-600 dark:text-indigo-400",
                },
                { label: "Rejected tickets", value: selected.rejected, cls: "text-red-600 dark:text-red-400" },
              ].map((c) => (
                <div key={c.label} className="p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950/50">
                  <div className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">{c.label}</div>
                  <div className={`text-2xl font-black mt-1 ${c.cls}`}>{c.value}</div>
                  {c.sub && <div className="text-[11px] text-neutral-500 mt-0.5">{c.sub}</div>}
                </div>
              ))}
            </div>
          )}

          {/* Table: per event (All) or per ticket tier (single event) */}
          <div className="overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800">
            <table className="w-full text-left text-sm text-neutral-600 dark:text-neutral-400">
              <thead className="bg-neutral-50 dark:bg-neutral-950/50 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                <tr>
                  <th className="px-4 py-3">{selected ? "Ticket type" : "Event"}</th>
                  <th className="px-4 py-3">Capacity</th>
                  <th className="px-4 py-3">Verified</th>
                  <th className="px-4 py-3">Pending</th>
                  <th className="px-4 py-3">Remaining</th>
                  <th className="px-4 py-3 w-40">Filled</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {(selected
                  ? [
                      ...selected.tiers.map((t) => ({ key: t.name, label: t.name, cap: t.total, verified: t.verified, pending: t.pending })),
                      ...(selected.unmatched.verified + selected.unmatched.pending > 0
                        ? [{ key: "__other", label: "Other / renamed type", cap: null, verified: selected.unmatched.verified, pending: selected.unmatched.pending }]
                        : []),
                    ]
                  : visibleRows.map((r) => ({ key: r.evt.id, label: eventLabel(r.evt), cap: r.cap, capNote: r.capNote, verified: r.verified, pending: r.pending }))
                ).map((row: { key: string; label: string; cap: number | null; capNote?: string; verified: number; pending: number }) => {
                  const remaining = row.cap !== null ? row.cap - row.verified - row.pending : null;
                  return (
                    <tr key={row.key}>
                      <td className="px-4 py-3 font-semibold text-neutral-900 dark:text-white">{row.label}</td>
                      <td className="px-4 py-3">
                        {row.cap ?? "—"}
                        {row.capNote && <div className="text-[10px] text-amber-600 dark:text-amber-400 leading-tight mt-0.5">{row.capNote}</div>}
                      </td>
                      <td className="px-4 py-3 font-bold text-green-600 dark:text-green-400">{row.verified}</td>
                      <td className="px-4 py-3 font-bold text-amber-600 dark:text-amber-400">{row.pending}</td>
                      <td className={`px-4 py-3 font-bold ${remaining !== null && remaining <= 0 ? "text-red-600 dark:text-red-400" : "text-indigo-600 dark:text-indigo-400"}`}>
                        {remaining === null ? "—" : remaining <= 0 ? (remaining < 0 ? `Over by ${-remaining}` : "FULL") : remaining}
                      </td>
                      <td className="px-4 py-3"><Bar verified={row.verified} pending={row.pending} capacity={row.cap} /></td>
                    </tr>
                  );
                })}
                {selected && selected.tiers.length === 0 && selected.unmatched.verified + selected.unmatched.pending === 0 && (
                  <tr><td colSpan={6} className="px-4 py-4 text-center text-neutral-500">No ticket types or bookings for this event yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="mt-2 flex items-center gap-4 text-[11px] text-neutral-500">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-green-500" /> Verified</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-400" /> Pending</span>
          </div>
        </>
      )}
    </div>
  );
}
