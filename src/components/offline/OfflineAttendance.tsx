"use client";

import { useEffect, useMemo, useState } from "react";
import type { AttendanceRow, OfflineApi, StatsBatch } from "@/utils/offlineTypes";
import { formatStamp, moneyTotal, serialText } from "@/utils/offlineFormat";

type Filter = "all" | "scanned" | "not_scanned" | "void";

const FILTER_LABEL: Record<Filter, string> = {
  all: "All tickets",
  scanned: "Scanned at the gate",
  not_scanned: "Not scanned yet",
  void: "Void (cancelled)",
};

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  checked_in: { label: "Scanned", cls: "bg-green-100 text-green-800 dark:bg-green-950/60 dark:text-green-300" },
  generated: { label: "Not scanned", cls: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300" },
  void: { label: "Void", cls: "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300" },
};

/**
 * Gate attendance for printed (offline) tickets: every ticket with its status and scan time,
 * with search, filters and a PDF export. It reloads whenever `tick` changes (the panel bumps
 * it every 30 seconds while the page is open).
 */
export default function OfflineAttendance({
  api,
  eventId,
  eventTitle,
  batches,
  tick,
}: {
  api: OfflineApi;
  eventId: string;
  eventTitle: string;
  batches: StatsBatch[];
  tick: number;
}) {
  const [rows, setRows] = useState<AttendanceRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [exporting, setExporting] = useState(false);

  // a different event: start clean
  useEffect(() => {
    setRows(null);
    setError(null);
    setSearch("");
    setFilter("all");
  }, [eventId]);

  // load, and reload on every refresh tick (a failed refresh keeps what is already on screen)
  useEffect(() => {
    let alive = true;
    api
      .listTickets(eventId)
      .then((list) => {
        if (!alive) return;
        setRows(list);
        setError(null);
      })
      .catch((e) => {
        if (alive) setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
      });
    return () => {
      alive = false;
    };
  }, [api, eventId, tick]);

  const batchInfo = useMemo(() => new Map(batches.map((b) => [b.id, { number: b.batch_number, quantity: b.quantity }])), [batches]);
  const batchNumbers = useMemo(() => new Map(batches.map((b) => [b.id, b.batch_number])), [batches]);

  const summary = useMemo(() => {
    const list = rows || [];
    const scanned = list.filter((r) => r.status === "checked_in").length;
    const voided = list.filter((r) => r.status === "void").length;
    const valid = list.length - voided;
    const cash = list.filter((r) => r.status !== "void").reduce((s, r) => s + r.price, 0);
    return { scanned, valid, void: voided, cash, pct: valid > 0 ? Math.round((scanned / valid) * 100) : 0 };
  }, [rows]);

  const shown = useMemo(() => {
    const q = search.trim().toUpperCase().replace(/^OFF-?/, "");
    const list = (rows || []).filter((r) => {
      if (filter === "scanned" && r.status !== "checked_in") return false;
      if (filter === "not_scanned" && r.status !== "generated") return false;
      if (filter === "void" && r.status !== "void") return false;
      if (!q) return true;
      return String(r.serial).includes(q.replace(/^0+/, "") || "0") || r.ticket_type.toUpperCase().includes(q);
    });
    // Scanned list: newest entry first; everything else: by serial number
    return filter === "scanned"
      ? [...list].sort((a, b) => String(b.checked_in_at).localeCompare(String(a.checked_in_at)))
      : list;
  }, [rows, filter, search]);

  async function exportPdf() {
    setExporting(true);
    try {
      const { downloadAttendancePdf } = await import("@/utils/offlineAttendancePdf");
      await downloadAttendancePdf({
        eventTitle,
        filterLabel: FILTER_LABEL[filter] + (search.trim() ? ` (search: ${search.trim()})` : ""),
        rows: shown,
        batchNumbers,
        summary,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create the PDF.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <section className="mb-6 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 sm:p-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-extrabold text-neutral-900 dark:text-white">Gate attendance</h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">Every printed ticket of this event and whether it has been scanned at the gate.</p>
        </div>
        <button
          type="button"
          onClick={exportPdf}
          disabled={exporting || shown.length === 0}
          className="rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-xs font-semibold text-neutral-700 shadow-sm transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800"
        >
          {exporting ? "Preparing..." : "Download attendance PDF"}
        </button>
      </div>

      {/* Scanned X of Y */}
      <div className="mb-4 rounded-xl border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-950/50">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="text-sm font-semibold text-neutral-600 dark:text-neutral-300">
            Scanned <span className="text-2xl font-black text-green-600 dark:text-green-400">{summary.scanned}</span> of{" "}
            <span className="text-2xl font-black text-neutral-900 dark:text-white">{summary.valid}</span> valid tickets
          </div>
          <div className="text-xs text-neutral-500">
            {summary.pct}% attended - {summary.void} void - cash to collect {moneyTotal(summary.cash)}
          </div>
        </div>
        <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800" aria-hidden="true">
          <div className="h-full bg-green-500 transition-all duration-500" style={{ width: `${summary.pct}%` }} />
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by serial (e.g. OFF-0042 or 42) or ticket type..."
          className="w-full rounded-xl border border-neutral-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-indigo-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white sm:max-w-md"
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as Filter)}
          aria-label="Filter by status"
          className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm font-semibold outline-none focus:border-indigo-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white sm:w-64"
        >
          {(Object.keys(FILTER_LABEL) as Filter[]).map((k) => (
            <option key={k} value={k}>
              {FILTER_LABEL[k]}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="mb-3 text-sm font-medium text-red-600 dark:text-red-400">{error}</p>}

      {rows === null && !error ? (
        <p className="py-8 text-center text-sm text-neutral-500">Loading attendance...</p>
      ) : shown.length === 0 ? (
        <p className="py-8 text-center text-sm text-neutral-500">
          {(rows || []).length === 0 ? "No offline tickets for this event yet." : "No tickets match this search or filter."}
        </p>
      ) : (
        <div className="max-h-[640px] overflow-auto rounded-xl border border-neutral-200 dark:border-neutral-800">
          <table className="w-full text-left text-sm text-neutral-600 dark:text-neutral-400">
            <thead className="sticky top-0 bg-neutral-50 text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:bg-neutral-950">
              <tr>
                <th className="px-4 py-3">Serial</th>
                <th className="px-4 py-3">Batch</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Scanned at</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {shown.map((r) => {
                const badge = STATUS_BADGE[r.status] || STATUS_BADGE.generated;
                const b = batchInfo.get(r.batch_id);
                return (
                  <tr key={r.id}>
                    <td className="px-4 py-2.5 font-extrabold text-neutral-900 dark:text-white">{serialText(r.serial)}</td>
                    <td className="px-4 py-2.5">{b ? `${b.number} (${r.position_in_batch}/${b.quantity})` : "-"}</td>
                    <td className="px-4 py-2.5">{r.ticket_type}</td>
                    <td className="px-4 py-2.5">{moneyTotal(r.price)}</td>
                    <td className="px-4 py-2.5">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${badge.cls}`}>{badge.label}</span>
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">{r.checked_in_at ? formatStamp(r.checked_in_at) : ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-2 text-[11px] text-neutral-500">
        Showing {shown.length} of {(rows || []).length} tickets.
      </p>
    </section>
  );
}
