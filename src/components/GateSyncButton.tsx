"use client";

import { useEffect, useState } from "react";
import {
  getGateSummary,
  listGateEvents,
  preloadGateSnapshot,
  syncGateTickets,
  type GateEventOption,
} from "@/utils/gateCache";

/**
 * "Sync Tickets": downloads the tickets of the chosen event (or all of your events) to THIS
 * device so the scanner can check them faster. An admin can pick any upcoming event, an
 * organizer any of their own. Press it once the bookings are done, and again if a booking is
 * verified or rejected later. It sits next to the scanner button; the scanner itself works
 * with or without it. Syncing one event keeps the other events already synced on this device.
 */
export default function GateSyncButton({ eventId }: { eventId?: string } = {}) {
  const [busy, setBusy] = useState(false);
  const [errorInfo, setErrorInfo] = useState<{ text: string; forChoice: string } | null>(null);
  const [ownChoice, setChoice] = useState("all"); // "all" or an event id
  // When the page has ONE event dropdown for everything, it passes the chosen event here
  // ("All" or an event id): this button then hides its own dropdown and follows the page.
  const controlled = eventId !== undefined;
  const choice = controlled ? (eventId === "All" ? "all" : eventId) : ownChoice;
  const [options, setOptions] = useState<GateEventOption[]>([]);
  const [, setTick] = useState(0); // re-draw after the saved list changes

  // Load the events for the dropdown, and what this device already holds
  useEffect(() => {
    let alive = true;
    preloadGateSnapshot().then(() => {
      if (alive) setTick((t) => t + 1);
    });
    listGateEvents().then((list) => {
      if (alive) setOptions(list);
    });
    return () => {
      alive = false;
    };
  }, []);

  async function run() {
    if (busy) return;
    setBusy(true);
    setErrorInfo(null);
    const result = await syncGateTickets(choice === "all" ? undefined : choice);
    if (!result.ok) setErrorInfo({ text: result.error, forChoice: choice });
    setTick((t) => t + 1);
    setBusy(false);
  }

  const hhmm = (ms: number) =>
    new Date(ms).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Karachi" });

  // An error belongs to the event it happened for; choosing another event hides it
  const error = errorInfo && errorInfo.forChoice === choice ? errorInfo.text : null;

  // The small status line under the button
  const summary = getGateSummary(choice === "all" ? undefined : choice);
  let status: string | null = null;
  if (choice === "all") {
    if (summary) {
      status = `Synced ${hhmm(summary.syncedAt)} · ${summary.events}${options.length ? ` of ${options.length}` : ""} event${summary.events === 1 ? "" : "s"} · ${summary.online} online, ${summary.offline} offline`;
    }
  } else {
    status = summary
      ? `Synced ${hhmm(summary.syncedAt)} · ${summary.online} online, ${summary.offline} offline`
      : "Not synced yet";
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex flex-wrap items-center gap-2">
        {!controlled && (
          <select
            value={choice}
            onChange={(e) => {
              setChoice(e.target.value);
            }}
            disabled={busy}
            aria-label="Event to sync"
            className="max-w-[14rem] rounded-xl border border-indigo-200 bg-white px-3 py-2.5 text-xs font-semibold text-neutral-800 shadow-sm outline-none focus:border-indigo-500 disabled:opacity-60 dark:border-indigo-900/60 dark:bg-neutral-900 dark:text-neutral-100"
          >
            <option value="all">All events{options.length ? ` (${options.length})` : ""}</option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.event_number ? `#${o.event_number} - ` : ""}
                {o.title}
              </option>
            ))}
          </select>
        )}
        <button
          type="button"
          onClick={run}
          disabled={busy}
          title="Downloads the tickets of the chosen event to this device so the scanner checks them faster. Press it again if a booking is verified or rejected later."
          className="rounded-xl border border-indigo-200 bg-white px-4 py-2.5 text-xs font-bold text-indigo-700 shadow-sm transition hover:bg-indigo-50 disabled:opacity-60 dark:border-indigo-900/60 dark:bg-neutral-900 dark:text-indigo-300 dark:hover:bg-neutral-800 flex items-center gap-2"
        >
          {busy ? (
            <>
              <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />
              <span>Syncing...</span>
            </>
          ) : (
            <>
              <span className="text-sm">⟳</span>
              <span>Sync Tickets</span>
            </>
          )}
        </button>
      </div>
      {error ? (
        <span role="alert" className="max-w-[20rem] text-[11px] font-semibold text-red-600 dark:text-red-400">
          {error}
        </span>
      ) : status ? (
        <span role="status" className="text-[11px] text-neutral-500 dark:text-neutral-400">
          {status}
        </span>
      ) : null}
    </div>
  );
}
