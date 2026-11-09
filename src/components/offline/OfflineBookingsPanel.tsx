"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import QRScannerModal from "@/components/QRScannerModal";
import ConfirmDialog from "@/components/offline/ConfirmDialog";
import OfflineDashboard from "@/components/offline/OfflineDashboard";
import OfflineLookup from "@/components/offline/OfflineLookup";
import OfflineTicketCard from "@/components/offline/OfflineTicketCard";
import { createOfflineApi } from "@/utils/offlineClient";
import { getEventTiers } from "@/utils/offlineTiers";
import { formatStamp, money, moneyTotal } from "@/utils/offlineFormat";
import { getEventLifecycle } from "@/utils/eventLifecycle";
import type { BatchData, OfflineApi, OfflineEvent, OfflineStats, StatsBatch } from "@/utils/offlineTypes";

const SOFT_LIMIT = 200; // a warning (not a stop) once an event has more offline tickets than this
const PREVIEW_COUNT = 12;
const WIDTH_KEY = "eg_offline_thermal_width";

type Notice = { type: "success" | "error"; text: string } | null;

const errText = (e: unknown) => (e instanceof Error && e.message ? e.message : "Something went wrong. Please try again.");

/**
 * The "Offline bookings" side of Manage Bookings (organizer and admin).
 * Organizers only ever see their own events (the database enforces this); admins see all.
 */
export default function OfflineBookingsPanel({ api: apiProp }: { api?: OfflineApi }) {
  const api = useMemo(() => apiProp ?? createOfflineApi(), [apiProp]);

  const [events, setEvents] = useState<OfflineEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventId, setEventId] = useState("");
  const [stats, setStats] = useState<OfflineStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);

  // generate form
  const [tierName, setTierName] = useState("");
  const [qtyInput, setQtyInput] = useState("");
  const [generating, setGenerating] = useState(false);
  const [confirmMore, setConfirmMore] = useState(false);

  // ticket cards for one batch
  const [viewData, setViewData] = useState<BatchData | null>(null);
  const [viewLoading, setViewLoading] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  // downloads / voiding
  const [thermalWidth, setThermalWidth] = useState<58 | 80>(80);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [confirmDownload, setConfirmDownload] = useState<{ batch: StatsBatch; kind: "a4" | "thermal" } | null>(null);
  const [confirmVoidBatch, setConfirmVoidBatch] = useState<StatsBatch | null>(null);
  const [confirmVoidTicket, setConfirmVoidTicket] = useState<{ id: string; label: string } | null>(null);
  const [voiding, setVoiding] = useState(false);

  const [scannerOpen, setScannerOpen] = useState(false);

  const selectedEvent = useMemo(() => events.find((e) => e.id === eventId) || null, [events, eventId]);
  const tiers = useMemo(() => getEventTiers(selectedEvent), [selectedEvent]);
  const tier = tiers.find((t) => t.name === tierName) || null;

  // remembered thermal paper width
  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem(WIDTH_KEY));
      if (saved === 58 || saved === 80) setThermalWidth(saved);
    } catch {}
  }, []);
  const changeWidth = (w: 58 | 80) => {
    setThermalWidth(w);
    try {
      localStorage.setItem(WIDTH_KEY, String(w));
    } catch {}
  };

  // events
  useEffect(() => {
    let alive = true;
    api
      .listEvents()
      .then((list) => {
        if (!alive) return;
        setEvents(list);
        const open = list.find((e) => e.status === "published" && getEventLifecycle(e).status !== "ended");
        setEventId((open || list[0])?.id || "");
      })
      .catch((e) => alive && setLoadError(errText(e)))
      .finally(() => alive && setEventsLoading(false));
    return () => {
      alive = false;
    };
  }, [api]);

  const refreshStats = useCallback(
    async (id: string) => {
      if (!id) return;
      setStatsLoading(true);
      try {
        setStats(await api.stats(id));
        setLoadError(null);
      } catch (e) {
        setLoadError(errText(e));
      } finally {
        setStatsLoading(false);
      }
    },
    [api]
  );

  // a different event: start clean
  useEffect(() => {
    setStats(null);
    setViewData(null);
    setShowAll(false);
    setNotice(null);
    setQtyInput("");
    if (eventId) refreshStats(eventId);
  }, [eventId, refreshStats]);

  useEffect(() => {
    setTierName(tiers[0]?.name ?? "");
  }, [tiers]);

  // ---------------------------------------------------------------- generate
  const qty = parseInt(qtyInput, 10);
  const validQty = Number.isInteger(qty) && qty >= 1 && qty <= 200 && String(qty) === qtyInput.trim();
  const eventOpen = !!selectedEvent && selectedEvent.status === "published" && getEventLifecycle(selectedEvent).status !== "ended";
  const expectedCash = validQty && tier ? qty * tier.price : null;
  const existing = stats ? stats.totals.total - stats.totals.void : 0;

  function onGenerateClick() {
    if (!canGenerate) return;
    if (existing + qty > SOFT_LIMIT) {
      setConfirmMore(true);
      return;
    }
    runGenerate();
  }

  async function runGenerate() {
    if (!tier || !validQty) return;
    setConfirmMore(false);
    setGenerating(true);
    setNotice(null);
    try {
      const data = await api.generate(eventId, tier.name, qty);
      const first = data.tickets[0]?.serial_label;
      const last = data.tickets[data.tickets.length - 1]?.serial_label;
      setViewData(data);
      setShowAll(false);
      setQtyInput("");
      setNotice({
        type: "success",
        text: `Batch ${data.batch.batch_number} created: ${data.tickets.length} ${data.batch.ticket_type} ticket(s), ${first} to ${last}. Cash to collect when sold: ${moneyTotal(
          data.tickets.length * (Number(data.batch.price) || 0)
        )}. Download the PDF below and print it.`,
      });
      await refreshStats(eventId);
    } catch (e) {
      setNotice({ type: "error", text: errText(e) });
    } finally {
      setGenerating(false);
    }
  }

  const canGenerate = eventOpen && validQty && !!tier && !generating;

  // ---------------------------------------------------------------- batch tickets (cards)
  async function openBatch(batch: StatsBatch) {
    if (viewData?.batch.id === batch.id) {
      setViewData(null);
      return;
    }
    setViewLoading(batch.id);
    try {
      setViewData(await api.getBatch(batch.id));
      setShowAll(false);
    } catch (e) {
      setNotice({ type: "error", text: errText(e) });
    } finally {
      setViewLoading(null);
    }
  }

  // ---------------------------------------------------------------- downloads
  function onDownload(batch: StatsBatch, kind: "a4" | "thermal") {
    if (batch.download_count > 0) {
      setConfirmDownload({ batch, kind });
      return;
    }
    runDownload(batch, kind);
  }

  async function runDownload(batch: StatsBatch, kind: "a4" | "thermal") {
    setConfirmDownload(null);
    setBusyKey(`${batch.id}:${kind}`);
    setNotice(null);
    try {
      // Rebuilt from the SAVED tickets: nothing new is ever created here
      const data = await api.getBatch(batch.id);
      const pdf = await import("@/utils/offlinePdf");
      if (kind === "a4") await pdf.downloadA4Pdf(data);
      else await pdf.downloadThermalPdf(data, thermalWidth);
      try {
        await api.recordDownload(batch.id);
      } catch {}
      setNotice({ type: "success", text: `Batch ${batch.batch_number} downloaded (${kind === "a4" ? "A4" : `thermal ${thermalWidth}mm`}).` });
      await refreshStats(eventId);
    } catch (e) {
      setNotice({ type: "error", text: errText(e) });
    } finally {
      setBusyKey(null);
    }
  }

  // ---------------------------------------------------------------- void
  async function runVoidBatch() {
    if (!confirmVoidBatch) return;
    const batch = confirmVoidBatch;
    setVoiding(true);
    try {
      const r = await api.voidBatch(batch.id);
      setNotice({
        type: "success",
        text: `Batch ${batch.batch_number} voided: ${r.voided} unused ticket(s) cancelled${r.already_used ? `, ${r.already_used} already used stay used` : ""}.`,
      });
      if (viewData?.batch.id === batch.id) setViewData(await api.getBatch(batch.id));
      await refreshStats(eventId);
    } catch (e) {
      setNotice({ type: "error", text: errText(e) });
    } finally {
      setVoiding(false);
      setConfirmVoidBatch(null);
    }
  }

  async function runVoidTicket() {
    if (!confirmVoidTicket || !viewData) return;
    setVoiding(true);
    try {
      await api.voidTicket(confirmVoidTicket.id);
      setNotice({ type: "success", text: `${confirmVoidTicket.label} is now void.` });
      setViewData(await api.getBatch(viewData.batch.id));
      await refreshStats(eventId);
    } catch (e) {
      setNotice({ type: "error", text: errText(e) });
    } finally {
      setVoiding(false);
      setConfirmVoidTicket(null);
    }
  }

  // ---------------------------------------------------------------- render
  if (eventsLoading) return <div className="p-12 text-center text-neutral-500">Loading offline tickets...</div>;

  if (events.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-neutral-300 p-10 text-center text-sm text-neutral-500 dark:border-neutral-700">
        {loadError || "You have no events yet, so there is nothing to create offline tickets for."}
      </div>
    );
  }

  const cardsToShow = viewData ? (showAll ? viewData.tickets : viewData.tickets.slice(0, PREVIEW_COUNT)) : [];
  const eventLabel = (e: OfflineEvent) => `${e.event_number ? `#${e.event_number} - ` : ""}${e.title}${e.status !== "published" ? ` (${e.status || "draft"})` : ""}`;

  return (
    <div>
      {/* Event + scanner */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <label className="block w-full sm:max-w-md">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Event</span>
          <select
            value={eventId}
            onChange={(e) => setEventId(e.target.value)}
            className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm font-semibold outline-none focus:border-indigo-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
          >
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {eventLabel(e)}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => setScannerOpen(true)}
          disabled={!selectedEvent}
          className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-50"
        >
          <span className="text-sm">📷</span>
          <span>{selectedEvent ? `Scan: ${selectedEvent.title}` : "QR Scanner"}</span>
        </button>
      </div>

      {loadError && (
        <p className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">{loadError}</p>
      )}
      {notice && (
        <p
          role="status"
          className={`mb-4 rounded-xl border p-3 text-sm font-semibold ${
            notice.type === "success"
              ? "border-green-200 bg-green-50 text-green-800 dark:border-green-900/50 dark:bg-green-950/40 dark:text-green-300"
              : "border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
          }`}
        >
          {notice.text}
        </p>
      )}

      <OfflineDashboard stats={stats} loading={statsLoading} />

      {/* Generate */}
      <section className="mb-6 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 sm:p-6">
        <h2 className="text-lg font-extrabold text-neutral-900 dark:text-white">Generate offline tickets</h2>
        <p className="mb-4 text-xs text-neutral-500 dark:text-neutral-400">
          Up to 200 tickets per batch. These tickets are extra: they do not use up the online capacity. The price comes from the event.
        </p>

        {!eventOpen && (
          <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300">
            Offline tickets can only be created for published events that have not ended.
          </p>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-neutral-600 dark:text-neutral-300">Ticket type</span>
            <select
              value={tierName}
              onChange={(e) => setTierName(e.target.value)}
              disabled={!eventOpen}
              className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500 disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
            >
              {tiers.map((t) => (
                <option key={t.name} value={t.name}>
                  {t.name} ({money(t.price)})
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-neutral-600 dark:text-neutral-300">Number of tickets (1 to 200)</span>
            <input
              inputMode="numeric"
              value={qtyInput}
              onChange={(e) => setQtyInput(e.target.value.replace(/[^\d]/g, "").slice(0, 3))}
              placeholder="e.g. 50"
              disabled={!eventOpen}
              className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500 disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
            />
          </label>
          <div className="flex items-end">
            <button
              type="button"
              onClick={onGenerateClick}
              disabled={!canGenerate}
              className="w-full rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-indigo-700 disabled:opacity-50"
            >
              {generating ? "Generating..." : "Generate tickets"}
            </button>
          </div>
        </div>

        {/* Cash calculator: so nobody has to do the sum */}
        <div className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-900/50 dark:bg-indigo-950/30" aria-live="polite">
          {expectedCash !== null && tier ? (
            <>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">Cash you should get back when all are sold</div>
              <div className="mt-1 text-2xl font-black text-indigo-700 dark:text-indigo-300">{moneyTotal(expectedCash)}</div>
              <div className="text-xs text-indigo-700/80 dark:text-indigo-300/80">
                {qty} {tier.name} ticket{qty === 1 ? "" : "s"} x {money(tier.price)}
              </div>
            </>
          ) : (
            <div className="text-sm text-indigo-700/80 dark:text-indigo-300/80">Choose a ticket type and a number of tickets to see how much cash you should get back.</div>
          )}
        </div>
      </section>

      {/* The tickets of one batch */}
      {viewData && (
        <section className="mb-6 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-extrabold text-neutral-900 dark:text-white">
              Batch {viewData.batch.batch_number}: {viewData.tickets.length} {viewData.batch.ticket_type} tickets
            </h2>
            <button type="button" onClick={() => setViewData(null)} className="text-sm font-semibold text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200">
              Hide tickets
            </button>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {cardsToShow.map((t) => (
              <div key={t.id}>
                <OfflineTicketCard ticket={t} event={viewData.event} batchNumber={viewData.batch.batch_number} batchQuantity={viewData.batch.quantity} />
                <div className="mx-auto mt-2 flex max-w-[340px] items-center justify-between text-xs">
                  <span className="font-semibold text-neutral-500">
                    {t.status === "generated" ? "Valid" : t.status === "checked_in" ? "Used" : "Void"}
                  </span>
                  {t.status === "generated" && (
                    <button
                      type="button"
                      onClick={() => setConfirmVoidTicket({ id: t.id, label: t.serial_label })}
                      className="font-bold text-red-600 hover:underline dark:text-red-400"
                    >
                      Void this ticket
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          {!showAll && viewData.tickets.length > PREVIEW_COUNT && (
            <div className="mt-5 text-center">
              <button
                type="button"
                onClick={() => setShowAll(true)}
                className="rounded-xl border border-neutral-300 px-5 py-2.5 text-sm font-bold text-neutral-700 transition hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
              >
                Show all {viewData.tickets.length} tickets
              </button>
            </div>
          )}
        </section>
      )}

      {/* Batches */}
      <section className="mb-6 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 sm:p-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-extrabold text-neutral-900 dark:text-white">Batches</h2>
          <label className="flex items-center gap-2 text-xs font-semibold text-neutral-600 dark:text-neutral-300">
            Thermal paper width
            <select
              value={thermalWidth}
              onChange={(e) => changeWidth(Number(e.target.value) === 58 ? 58 : 80)}
              className="rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-xs outline-none focus:border-indigo-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
            >
              <option value={80}>80 mm</option>
              <option value={58}>58 mm</option>
            </select>
          </label>
        </div>

        <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-medium leading-relaxed text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300">
          Reminder: make sure every printed ticket is either sold or returned to you. Tickets that are not returned stay valid until you void them
          (use <b>Void batch</b>, or open a batch and void single tickets).
        </p>

        {!stats || stats.by_batch.length === 0 ? (
          <p className="py-6 text-center text-sm text-neutral-500">No batches yet for this event.</p>
        ) : (
          <ul className="space-y-3">
            {stats.by_batch.map((b) => {
              const total = b.scanned + b.not_scanned + b.void;
              const busyA4 = busyKey === `${b.id}:a4`;
              const busyTh = busyKey === `${b.id}:thermal`;
              const allVoid = total > 0 && b.void === total;
              return (
                <li key={b.id} className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-base font-extrabold text-neutral-900 dark:text-white">
                        Batch {b.batch_number} <span className="font-semibold text-neutral-500">- {b.ticket_type}</span>
                      </div>
                      <div className="text-xs text-neutral-500">
                        {formatStamp(b.created_at)} by {b.generated_by}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Cash to collect</div>
                      <div className="text-lg font-black text-indigo-600 dark:text-indigo-400">{moneyTotal(b.expected_cash)}</div>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
                    <Stat label="Quantity" value={`${b.quantity} x ${money(b.price)}`} />
                    <Stat label="Scanned" value={b.scanned} cls="text-green-600 dark:text-green-400" />
                    <Stat label="Not scanned" value={b.not_scanned} cls="text-amber-600 dark:text-amber-400" />
                    <Stat label="Void" value={b.void} cls="text-red-600 dark:text-red-400" />
                    <Stat label="Downloaded" value={b.download_count === 0 ? "not yet" : `${b.download_count} time${b.download_count === 1 ? "" : "s"}`} />
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onDownload(b, "a4")}
                      disabled={!!busyKey || allVoid}
                      className="rounded-lg bg-neutral-900 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-black disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
                    >
                      {busyA4 ? "Preparing..." : "Download A4 PDF"}
                    </button>
                    <button
                      type="button"
                      onClick={() => onDownload(b, "thermal")}
                      disabled={!!busyKey || allVoid}
                      className="rounded-lg bg-neutral-900 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-black disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
                    >
                      {busyTh ? "Preparing..." : `Download thermal PDF (${thermalWidth}mm)`}
                    </button>
                    <button
                      type="button"
                      onClick={() => openBatch(b)}
                      disabled={viewLoading === b.id}
                      className="rounded-lg border border-neutral-300 px-3.5 py-2 text-xs font-bold text-neutral-700 transition hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
                    >
                      {viewLoading === b.id ? "Loading..." : viewData?.batch.id === b.id ? "Hide tickets" : "View tickets"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmVoidBatch(b)}
                      disabled={b.not_scanned === 0}
                      className="rounded-lg border border-red-300 px-3.5 py-2 text-xs font-bold text-red-600 transition hover:bg-red-50 disabled:opacity-40 dark:border-red-900/60 dark:text-red-400 dark:hover:bg-red-950/40"
                    >
                      Void batch
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <OfflineLookup api={api} eventId={eventId} onChanged={() => refreshStats(eventId)} />

      {/* Dialogs */}
      <ConfirmDialog
        open={confirmMore}
        title="More than 200 offline tickets for this event"
        confirmLabel="Generate anyway"
        onConfirm={runGenerate}
        onCancel={() => setConfirmMore(false)}
      >
        This event already has <b>{existing}</b> offline tickets. Generating <b>{validQty ? qty : 0}</b> more makes <b>{existing + (validQty ? qty : 0)}</b>. Do you want to continue?
      </ConfirmDialog>

      <ConfirmDialog
        open={!!confirmDownload}
        title="Already downloaded"
        confirmLabel="Download anyway"
        onConfirm={() => confirmDownload && runDownload(confirmDownload.batch, confirmDownload.kind)}
        onCancel={() => setConfirmDownload(null)}
      >
        These tickets were already downloaded. <b>Printing the same sheet twice creates duplicate paper tickets.</b> The tickets and QR codes are exactly the same as before; nothing new is created.
      </ConfirmDialog>

      <ConfirmDialog
        open={!!confirmVoidBatch}
        title={`Void batch ${confirmVoidBatch?.batch_number ?? ""}?`}
        confirmLabel="Void batch"
        danger
        busy={voiding}
        onConfirm={runVoidBatch}
        onCancel={() => setConfirmVoidBatch(null)}
      >
        <b>{confirmVoidBatch?.not_scanned ?? 0}</b> unused ticket(s) will stop working at the gate. Tickets already scanned (<b>{confirmVoidBatch?.scanned ?? 0}</b>) stay used.
        <b> This cannot be undone.</b>
      </ConfirmDialog>

      <ConfirmDialog
        open={!!confirmVoidTicket}
        title={`Void ${confirmVoidTicket?.label ?? "ticket"}?`}
        confirmLabel="Void ticket"
        danger
        busy={voiding}
        onConfirm={runVoidTicket}
        onCancel={() => setConfirmVoidTicket(null)}
      >
        This ticket will stop working at the gate. <b>This cannot be undone.</b>
      </ConfirmDialog>

      {/* Scanner: always locked to the chosen event (no "any event" here) */}
      {selectedEvent && (
        <QRScannerModal
          isOpen={scannerOpen}
          onClose={() => setScannerOpen(false)}
          fixedEventId={selectedEvent.id}
          fixedEventTitle={selectedEvent.title}
          eventsList={[{ id: selectedEvent.id, title: selectedEvent.title, event_number: selectedEvent.event_number ?? undefined }]}
          onScanSuccess={() => refreshStats(eventId)}
        />
      )}
    </div>
  );
}

function Stat({ label, value, cls = "text-neutral-900 dark:text-white" }: { label: string; value: string | number; cls?: string }) {
  return (
    <div className="rounded-lg bg-neutral-50 px-3 py-2 dark:bg-neutral-950/50">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">{label}</div>
      <div className={`text-sm font-extrabold ${cls}`}>{value}</div>
    </div>
  );
}
