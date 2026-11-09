"use client";

import type { OfflineStats } from "@/utils/offlineTypes";
import { money } from "@/utils/offlineFormat";

/** The offline numbers for one event: same look as the online "Tickets Overview". */
export default function OfflineDashboard({ stats, loading }: { stats: OfflineStats | null; loading: boolean }) {
  const t = stats?.totals;
  const cards = [
    { label: "Tickets generated", value: t ? t.total : "—", cls: "text-neutral-900 dark:text-white" },
    { label: "Scanned at the gate", value: t ? t.scanned : "—", cls: "text-green-600 dark:text-green-400" },
    { label: "Not scanned yet", value: t ? t.not_scanned : "—", cls: "text-amber-600 dark:text-amber-400" },
    { label: "Void (cancelled)", value: t ? t.void : "—", cls: "text-red-600 dark:text-red-400" },
    { label: "Cash to collect", value: t ? money(t.expected_cash) : "—", cls: "text-indigo-600 dark:text-indigo-400", sub: "all tickets that are not void" },
  ];

  return (
    <div className="mb-6 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 sm:p-6">
      <div className="mb-4">
        <h2 className="text-lg font-extrabold text-neutral-900 dark:text-white">Offline Tickets Overview</h2>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          Printed cash tickets for this event. These are separate from the online capacity and online bookings.
        </p>
      </div>

      <div className={`grid grid-cols-2 gap-3 lg:grid-cols-5 ${loading ? "opacity-60" : ""}`}>
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-950/50">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">{c.label}</div>
            <div className={`mt-1 text-2xl font-black ${c.cls}`}>{c.value}</div>
            {c.sub && <div className="mt-0.5 text-[11px] text-neutral-500">{c.sub}</div>}
          </div>
        ))}
      </div>

      {stats && stats.by_type.length > 0 && (
        <div className="mt-5 overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800">
          <table className="w-full text-left text-sm text-neutral-600 dark:text-neutral-400">
            <thead className="bg-neutral-50 text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:bg-neutral-950/50">
              <tr>
                <th className="px-4 py-3">Ticket type</th>
                <th className="px-4 py-3">Generated</th>
                <th className="px-4 py-3">Scanned</th>
                <th className="px-4 py-3">Not scanned</th>
                <th className="px-4 py-3">Void</th>
                <th className="px-4 py-3">Cash to collect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {stats.by_type.map((row) => (
                <tr key={row.ticket_type}>
                  <td className="px-4 py-3 font-semibold text-neutral-900 dark:text-white">{row.ticket_type}</td>
                  <td className="px-4 py-3">{row.total}</td>
                  <td className="px-4 py-3 font-bold text-green-600 dark:text-green-400">{row.scanned}</td>
                  <td className="px-4 py-3 font-bold text-amber-600 dark:text-amber-400">{row.not_scanned}</td>
                  <td className="px-4 py-3 font-bold text-red-600 dark:text-red-400">{row.void}</td>
                  <td className="px-4 py-3 font-bold text-indigo-600 dark:text-indigo-400">{money(row.expected_cash)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {stats && stats.totals.total === 0 && (
        <p className="mt-4 text-center text-sm text-neutral-500">No offline tickets for this event yet. Use the form below to generate your first batch.</p>
      )}
    </div>
  );
}
