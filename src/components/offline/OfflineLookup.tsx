"use client";

import { useEffect, useState } from "react";
import type { LookupResult, OfflineApi } from "@/utils/offlineTypes";
import { formatStamp, money } from "@/utils/offlineFormat";

type Found = Extract<LookupResult, { found: true }>;

/**
 * "Check a ticket": type the serial number and the short check code printed beside it.
 * Both are needed, so someone who only copied a serial number cannot get anything out of it.
 * If a QR is smudged, gate staff can also check the ticket in from here (still only once).
 */
export default function OfflineLookup({
  api,
  eventId,
  onChanged,
}: {
  api: OfflineApi;
  eventId: string;
  onChanged: () => void;
}) {
  const [serial, setSerial] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noMatch, setNoMatch] = useState<string | null>(null);
  const [found, setFound] = useState<Found | null>(null);
  const [checkInMsg, setCheckInMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    // a different event was chosen: start fresh
    setSerial("");
    setCode("");
    setError(null);
    setNoMatch(null);
    setFound(null);
    setCheckInMsg(null);
  }, [eventId]);

  async function run(checkIn: boolean) {
    if (!serial.trim() || !code.trim()) {
      setError("Please type both the serial number and the check code.");
      return;
    }
    setBusy(true);
    setError(null);
    setNoMatch(null);
    if (!checkIn) {
      setFound(null);
      setCheckInMsg(null);
    }
    try {
      const result = await api.lookup(eventId, serial, code, checkIn);
      if (!result.found) {
        setNoMatch(result.message);
        setFound(null);
        return;
      }
      if (checkIn && result.checkIn) {
        setCheckInMsg({ ok: result.checkIn.result === "valid", text: result.checkIn.message });
        onChanged();
        // show the fresh status
        const again = await api.lookup(eventId, serial, code, false);
        if (again.found) setFound(again);
        return;
      }
      setFound(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const t = found?.ticket;
  const statusLabel =
    t?.status === "checked_in"
      ? `USED - scanned ${formatStamp(t.checked_in_at)}`
      : t?.status === "void"
      ? "VOID - cancelled"
      : "VALID - not used yet";
  const statusCls =
    t?.status === "generated"
      ? "bg-green-100 text-green-800 dark:bg-green-950/60 dark:text-green-300"
      : t?.status === "void"
      ? "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300"
      : "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300";

  const row = (label: string, value: string | number) => (
    <div>
      <dt className="inline text-neutral-500">{label}: </dt>
      <dd className="inline font-semibold text-neutral-900 dark:text-white">{value}</dd>
    </div>
  );

  return (
    <section className="mb-6 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 sm:p-6">
      <h2 className="text-lg font-extrabold text-neutral-900 dark:text-white">Check a ticket</h2>
      <p className="mb-4 text-xs text-neutral-500 dark:text-neutral-400">
        Someone says their offline ticket does not work? Type the serial number and the check code printed under the QR to see if it is a real
        ticket of this event.
      </p>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="block flex-1">
          <span className="mb-1 block text-xs font-semibold text-neutral-600 dark:text-neutral-300">Serial number</span>
          <input
            value={serial}
            onChange={(e) => setSerial(e.target.value)}
            placeholder="OFF-0007"
            autoCapitalize="characters"
            className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
          />
        </label>
        <label className="block flex-1">
          <span className="mb-1 block text-xs font-semibold text-neutral-600 dark:text-neutral-300">Check code</span>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="K3F9X"
            autoCapitalize="characters"
            className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm uppercase outline-none focus:border-indigo-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
          />
        </label>
        <button
          type="button"
          onClick={() => run(false)}
          disabled={busy || !eventId}
          className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-indigo-700 disabled:opacity-50"
        >
          {busy && !found ? "Checking..." : "Check ticket"}
        </button>
      </div>

      {error && <p className="mt-3 text-sm font-medium text-red-600 dark:text-red-400">{error}</p>}
      {noMatch && (
        <p className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
          {noMatch} This is not a ticket made by us for this event.
        </p>
      )}

      {t && (
        <div className="mt-4 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xl font-black text-neutral-900 dark:text-white">{t.serial_label}</span>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusCls}`}>{statusLabel}</span>
          </div>
          <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
            {row("Event", t.event_title)}
            {row("Batch", `${t.batch_number} (ticket ${t.position} of ${t.batch_quantity})`)}
            {row("Type", t.ticket_type)}
            {row("Price", money(t.price))}
            {row("Generated", formatStamp(t.generated_at))}
            {row("Generated by", t.generated_by)}
          </dl>

          {t.status === "generated" && (
            <div className="mt-4 border-t border-neutral-200 pt-3 dark:border-neutral-800">
              <p className="mb-2 text-xs text-neutral-500">QR code damaged? You can let this person in from here. It works only once.</p>
              <button
                type="button"
                onClick={() => run(true)}
                disabled={busy}
                className="rounded-xl bg-green-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-green-700 disabled:opacity-50"
              >
                {busy ? "Please wait..." : "Check in this ticket"}
              </button>
            </div>
          )}
          {checkInMsg && (
            <p className={`mt-3 text-sm font-bold ${checkInMsg.ok ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>{checkInMsg.text}</p>
          )}
        </div>
      )}
    </section>
  );
}
