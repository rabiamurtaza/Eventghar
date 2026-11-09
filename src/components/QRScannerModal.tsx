"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { playSuccessChime, playErrorBuzzer } from "@/utils/ticketService";

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  fixedEventId?: string;
  fixedEventTitle?: string;
  isAdmin?: boolean;
  eventsList?: Array<{ id: string; title: string; event_number?: number | string }>;
  onScanSuccess?: () => void;
}

interface ScanResult {
  type: "success" | "wrong_event" | "already_used" | "invalid" | "void";
  message: string;
  details?: {
    holder_name?: string;
    ticket_code?: string;
    ticket_number?: number;
    total_tickets?: number;
    ticket_type?: string;
    event_title?: string;
    scanned_at?: string;
  };
  /** Set only for OFFLINE (printed cash) tickets */
  offline?: {
    serial_label: string;
    batch_number: number;
    batch_quantity: number;
    position: number;
    price: number;
    ticket_type: string;
    event_title: string;
  };
  timestamp: string;
}

export default function QRScannerModal({
  isOpen,
  onClose,
  fixedEventId,
  fixedEventTitle,
  isAdmin = false,
  eventsList = [],
  onScanSuccess,
}: QRScannerModalProps) {
  const [selectedEventId, setSelectedEventId] = useState<string>(fixedEventId || "");
  const [currentResult, setCurrentResult] = useState<ScanResult | null>(null);
  const [scanHistory, setScanHistory] = useState<ScanResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);

  const html5QrCodeRef = useRef<any>(null);
  const isMountedRef = useRef(true);
  const isScanLockedRef = useRef(false);
  const lastScannedTicketRef = useRef<{ code: string; time: number } | null>(null);

  // Set selectedEventId when fixedEventId changes or defaults
  useEffect(() => {
    if (fixedEventId) {
      setSelectedEventId(fixedEventId);
    } else if (eventsList.length > 0 && !selectedEventId) {
      setSelectedEventId(eventsList[0].id);
    }
  }, [fixedEventId, eventsList]);

  // Start scanner when modal opens
  useEffect(() => {
    if (!isOpen) return;
    isMountedRef.current = true;
    isScanLockedRef.current = false;
    lastScannedTicketRef.current = null;
    let html5QrCode: any = null;

    async function startScanner() {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (!isMountedRef.current) return;

        html5QrCode = new Html5Qrcode("qr-camera-feed");
        html5QrCodeRef.current = html5QrCode;

        const config = {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        };

        await html5QrCode.start(
          { facingMode: "environment" },
          config,
          (decodedText: string) => {
            handleDecodedText(decodedText);
          },
          () => {
            // Frame failed to parse QR - ignore normal continuous scanning noise
          }
        );

        // If user closed modal while camera was starting up, stop and release immediately
        if (!isMountedRef.current) {
          try {
            await html5QrCode.stop();
            html5QrCode.clear();
          } catch {}
          return;
        }
      } catch (err: any) {
        console.error("Failed to start camera scanner:", err);
        setScannerError(
          err?.message || "Unable to access camera. Please check camera permissions in your browser."
        );
      }
    }

    // Small delay to ensure modal DOM is mounted
    const timer = setTimeout(() => {
      startScanner();
    }, 200);

    return () => {
      clearTimeout(timer);
      isMountedRef.current = false;
      isScanLockedRef.current = false;
      lastScannedTicketRef.current = null;
      const scanner = html5QrCodeRef.current;
      if (scanner) {
        html5QrCodeRef.current = null;
        try {
          const state = typeof scanner.getState === "function" ? scanner.getState() : null;
          // State 2 = SCANNING, State 3 = PAUSED
          if (scanner.isScanning || state === 2 || state === 3) {
            scanner.stop().then(() => {
              try { scanner.clear(); } catch (e) {}
            }).catch(() => {});
          } else {
            try { scanner.clear(); } catch (e) {}
          }
        } catch (e) {}
      }
    };
  }, [isOpen, selectedEventId]);

  // Keyboard shortcut (Enter, Space, Escape) to dismiss the result card and instantly resume scanning
  useEffect(() => {
    if (!currentResult) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " " || e.key === "Escape") {
        e.preventDefault();
        handleDismissResult();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentResult]);

  const handleDismissResult = () => {
    // Instantly dismiss result and unlock scanner with zero delay
    setCurrentResult(null);
    setIsProcessing(false);
    isScanLockedRef.current = false;
  };

  // OFFLINE (printed cash) tickets: the website's server checks the secret seal and checks the
  // ticket in. Online tickets never come through here.
  const handleOfflineScan = async (qr: string, timeStr: string) => {
    const show = (res: ScanResult, success = false) => {
      if (success) playSuccessChime(); else playErrorBuzzer();
      setCurrentResult(res);
      setScanHistory((prev) => [res, ...prev.slice(0, 9)]);
    };

    try {
      const response = await fetch("/api/offline/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qr, eventId: selectedEventId || undefined }),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok || !data || !data.result) {
        show({
          type: "invalid",
          message: `Could not check the ticket (${data?.error || "no connection"}). Do NOT admit yet - check the connection and scan again.`,
          timestamp: timeStr,
        });
        return;
      }

      const type: ScanResult["type"] =
        data.result === "valid" ? "success"
        : data.result === "already_used" ? "already_used"
        : data.result === "void" ? "void"
        : data.result === "wrong_event" ? "wrong_event"
        : "invalid";
      const d = data.details;
      show(
        {
          type,
          message: data.message,
          offline: d
            ? {
                serial_label: d.serial_label,
                batch_number: d.batch_number,
                batch_quantity: d.batch_quantity,
                position: d.position,
                price: d.price,
                ticket_type: d.ticket_type,
                event_title: d.event_title,
              }
            : undefined,
          timestamp: timeStr,
        },
        type === "success"
      );
      if (type === "success" && onScanSuccess) onScanSuccess();
    } catch {
      show({
        type: "invalid",
        message: "Could not reach the server. Do NOT admit yet - check the connection and scan again.",
        timestamp: timeStr,
      });
    }
  };

  const handleDecodedText = async (decodedText: string) => {
    // 1. Synchronous lock check: immediately ignore frames while reviewing current result or verifying
    if (isScanLockedRef.current) return;

    // 2. Prevent instant duplicate re-reads of the same ticket immediately after dismissal (2.5s cooldown)
    if (
      lastScannedTicketRef.current &&
      lastScannedTicketRef.current.code === decodedText &&
      Date.now() - lastScannedTicketRef.current.time < 2500
    ) {
      return;
    }

    isScanLockedRef.current = true;
    setIsProcessing(true);
    lastScannedTicketRef.current = { code: decodedText, time: Date.now() };

    const supabase = createClient();
    const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

    try {
      // 2b. Offline (printed cash) ticket? They start with "OFF." and are handled by the server
      if (decodedText.trim().startsWith("OFF.")) {
        await handleOfflineScan(decodedText.trim(), timeStr);
        return;
      }

      // 3. Parse JSON payload
      let parsed: any = null;
      try {
        parsed = JSON.parse(decodedText);
      } catch (e) {
        // Not a JSON payload
      }

      if (!parsed || parsed.app !== "EVENT_GHAR" || !parsed.ticket_id) {
        playErrorBuzzer();
        const res: ScanResult = {
          type: "invalid",
          message: "Not an Event Ghar ticket. Corrupted or invalid QR code.",
          timestamp: timeStr,
        };
        setCurrentResult(res);
        setScanHistory((prev) => [res, ...prev.slice(0, 9)]);
        return;
      }

      // Helper to show a result card and log it
      const showResult = (res: ScanResult, success = false) => {
        if (success) playSuccessChime(); else playErrorBuzzer();
        setCurrentResult(res);
        setScanHistory((prev) => [res, ...prev.slice(0, 9)]);
      };

      // 4. Database Check (the database is the source of truth, not the QR content)
      const { data: ticket, error } = await supabase
        .from("issued_tickets")
        .select(`
          *,
          events (
            id,
            title,
            event_number
          )
        `)
        .eq("id", parsed.ticket_id)
        .maybeSingle();

      // 22P02 = malformed ticket id (not a real ticket) -> handled as "not found" below
      if (error && error.code !== "22P02") {
        showResult({
          type: "invalid",
          message: `Could not check ticket (${error.message}). Do NOT admit yet - check the connection and scan again.`,
          details: { holder_name: parsed.holder_name, ticket_code: parsed.ticket_code },
          timestamp: timeStr,
        });
        return;
      }

      if (!ticket || (parsed.ticket_code && ticket.ticket_code && parsed.ticket_code !== ticket.ticket_code)) {
        showResult({
          type: "invalid",
          message: "Ticket not found in the database. Do not admit - ask the attendee to show their booking.",
          details: { holder_name: parsed.holder_name, ticket_code: parsed.ticket_code },
          timestamp: timeStr,
        });
        return;
      }

      const ticketDetails = {
        holder_name: ticket.holder_name,
        ticket_code: ticket.ticket_code,
        ticket_number: ticket.ticket_number,
        total_tickets: ticket.total_tickets,
        ticket_type: ticket.ticket_type,
        event_title: ticket.events?.title,
        scanned_at: ticket.scanned_at,
      };

      // 5. Check the ticket belongs to the event being scanned (using the database record)
      if (selectedEventId && ticket.event_id !== selectedEventId) {
        const activeEventObj = eventsList.find((e) => e.id === selectedEventId);
        const activeName = fixedEventTitle || activeEventObj?.title || "Active Event";
        const scannedEventName = ticket.events?.title || "Another Event";
        showResult({
          type: "wrong_event",
          message: `Wrong Event! This ticket belongs to "${scannedEventName}", not "${activeName}".`,
          details: ticketDetails,
          timestamp: timeStr,
        });
        return;
      }

      // 6. Check ticket status
      const alreadyUsedResult = (scannedAt?: string | null): ScanResult => ({
        type: "already_used",
        message: `Ticket Already Used! Scanned at ${
          scannedAt ? new Date(scannedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "earlier"
        }.`,
        details: { ...ticketDetails, scanned_at: scannedAt || undefined },
        timestamp: timeStr,
      });

      if (ticket.status === "used" || ticket.status === "scanned") {
        showResult(alreadyUsedResult(ticket.scanned_at));
        return;
      }

      if (ticket.status && ticket.status !== "valid") {
        showResult({
          type: "invalid",
          message: `Ticket is ${String(ticket.status).toUpperCase()} and cannot be used for entry.`,
          details: ticketDetails,
          timestamp: timeStr,
        });
        return;
      }

      // 7. Check the booking is still verified (blocks bookings rejected after tickets were issued)
      if (ticket.booking_id) {
        const { data: booking } = await supabase
          .from("bookings")
          .select("status")
          .eq("id", ticket.booking_id)
          .maybeSingle();

        if (booking && booking.status !== "verified" && booking.status !== "confirmed") {
          showResult({
            type: "invalid",
            message: `Booking is ${String(booking.status).toUpperCase()} - this ticket is not valid for entry.`,
            details: ticketDetails,
            timestamp: timeStr,
          });
          return;
        }
      }

      // 8. Mark as used ONLY if it is still valid. This is a single atomic database step,
      //    so two gates scanning the same ticket at the same moment cannot both admit it.
      const { data: { session } } = await supabase.auth.getSession();
      const nowIso = new Date().toISOString();

      const { data: updatedRows, error: updateError } = await supabase
        .from("issued_tickets")
        .update({
          status: "used",
          scanned_at: nowIso,
          scanned_by: session?.user?.id || null,
        })
        .eq("id", ticket.id)
        .eq("status", "valid")
        .select("id");

      if (updateError) {
        showResult({
          type: "invalid",
          message: `Entry NOT recorded (${updateError.message}). Do NOT admit - scan again.`,
          details: ticketDetails,
          timestamp: timeStr,
        });
        return;
      }

      if (!updatedRows || updatedRows.length === 0) {
        // Either another gate just used it, or the database refused the change.
        const { data: latest } = await supabase
          .from("issued_tickets")
          .select("status, scanned_at")
          .eq("id", ticket.id)
          .maybeSingle();

        if (latest && (latest.status === "used" || latest.status === "scanned")) {
          showResult(alreadyUsedResult(latest.scanned_at));
        } else {
          showResult({
            type: "invalid",
            message: "Entry NOT recorded - the database did not accept the check-in (permission problem). Do NOT admit; contact the admin.",
            details: ticketDetails,
            timestamp: timeStr,
          });
        }
        return;
      }

      showResult(
        {
          type: "success",
          message: "VALID ENTRY (Admitted)",
          details: { ...ticketDetails, scanned_at: nowIso },
          timestamp: timeStr,
        },
        true
      );

      if (onScanSuccess) {
        onScanSuccess();
      }
    } catch (err: any) {
      console.error("Scan processing error:", err);
      playErrorBuzzer();
      const res: ScanResult = {
        type: "invalid",
        message: err.message || "Error processing ticket.",
        timestamp: timeStr,
      };
      setCurrentResult(res);
      setScanHistory((prev) => [res, ...prev.slice(0, 9)]);
    }
  };

  const activeEventTitle = fixedEventTitle || eventsList.find((e) => e.id === selectedEventId)?.title || "All Events";

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 animate-in fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative max-h-[95vh] max-w-lg w-full bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden shadow-lg flex flex-col text-white"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-neutral-800 flex items-center justify-between bg-neutral-900/90">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600/30 text-indigo-400 border border-indigo-500/30 text-sm">
              📷
            </span>
            <div>
              <h2 className="text-base font-bold text-white">Event Ghar Gate Scanner</h2>
              <p className="text-xs text-neutral-400">
                {fixedEventTitle ? `Locked to: ${fixedEventTitle}` : "Scan attendee ticket QR"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
          >
            ✕
          </button>
        </div>

        {/* Event Selector (for Admin, or if not locked) */}
        {!fixedEventId && eventsList.length > 0 && (
          <div className="px-5 py-3 bg-neutral-950/70 border-b border-neutral-800 flex items-center gap-3">
            <span className="text-xs font-semibold text-neutral-400 shrink-0">Scanning Event:</span>
            <select
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-xs text-white outline-none focus:border-indigo-500"
            >
              <option value="">-- Any Event --</option>
              {eventsList.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.event_number ? `#${e.event_number} - ` : ""}{e.title}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Camera Viewfinder Area */}
        <div className="p-4 sm:p-6 flex flex-col items-center justify-center bg-black relative">
          {scannerError ? (
            <div className="p-6 text-center text-red-400 text-sm">
              <p className="mb-2 font-bold text-base">Camera Error</p>
              <p>{scannerError}</p>
            </div>
          ) : (
            <div className="relative w-full max-w-[300px] aspect-square rounded-lg overflow-hidden border-2 border-indigo-500/50 shadow-inner bg-neutral-950">
              <div id="qr-camera-feed" className="w-full h-full object-cover"></div>

              {/* Force hide any internal html5-qrcode pause/banner overlays */}
              <style
                dangerouslySetInnerHTML={{
                  __html: `
                    #qr-camera-feed div[style*="rgba(9, 9, 9"],
                    #qr-camera-feed div[style*="background: rgba"] {
                      display: none !important;
                    }
                  `,
                }}
              />

              {/* Viewfinder Target Overlay */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div
                  className={`w-48 h-48 border-2 rounded-xl transition-all duration-200 ${
                    currentResult
                      ? currentResult.type === "success"
                        ? "border-green-400 bg-green-500/10 shadow-[0_0_15px_rgba(34,197,94,0.3)]"
                        : currentResult.type === "wrong_event"
                        ? "border-amber-400 bg-amber-500/10 shadow-[0_0_15px_rgba(245,158,11,0.3)]"
                        : "border-red-400 bg-red-500/10 shadow-[0_0_15px_rgba(239,68,68,0.3)]"
                      : "border-dashed border-indigo-400/70 animate-pulse"
                  }`}
                ></div>
              </div>

              {isProcessing && !currentResult && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-xs font-bold text-white">
                  Verifying...
                </div>
              )}
            </div>
          )}
          <p className="text-[11px] text-neutral-500 mt-2 text-center">
            Position the attendee&apos;s ticket QR code inside the box.
          </p>
        </div>

        {/* Live Scan Result Card with Simple OK Button */}
        {currentResult && (
          <div
            className={`p-4 border-t transition-all duration-300 animate-in fade-in slide-in-from-bottom-2 ${
              currentResult.type === "success"
                ? "bg-green-950/90 border-green-700 text-green-200"
                : currentResult.type === "already_used"
                ? "bg-red-950/90 border-red-700 text-red-200"
                : currentResult.type === "wrong_event"
                ? "bg-amber-950/90 border-amber-700 text-amber-200"
                : "bg-red-950/90 border-red-700 text-red-200"
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl font-bold ${
                  currentResult.type === "success"
                    ? "bg-green-500 text-white"
                    : currentResult.type === "already_used"
                    ? "bg-red-600 text-white"
                    : currentResult.type === "wrong_event"
                    ? "bg-amber-500 text-white"
                    : "bg-red-500 text-white"
                }`}
              >
                {currentResult.type === "success"
                  ? "✓"
                  : currentResult.type === "already_used" || currentResult.type === "void"
                  ? "✕"
                  : currentResult.type === "wrong_event"
                  ? "⚠️"
                  : "!"}
              </div>

              <div className="overflow-hidden flex-1 min-w-0">
                {currentResult.offline && (
                  <span className="mb-1 inline-block rounded bg-white px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-black">
                    Offline ticket
                  </span>
                )}
                <div className="font-extrabold text-sm sm:text-base leading-tight">
                  {currentResult.message}
                </div>
                {currentResult.offline && (
                  <div className="text-xs opacity-90 mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                    <span><strong>Serial:</strong> {currentResult.offline.serial_label}</span>
                    <span><strong>Batch:</strong> {currentResult.offline.batch_number} ({currentResult.offline.position} of {currentResult.offline.batch_quantity})</span>
                    <span><strong>Type:</strong> {currentResult.offline.ticket_type}</span>
                    <span><strong>Price:</strong> {currentResult.offline.price === 0 ? "Free" : `Rs. ${currentResult.offline.price.toLocaleString("en-US")}`}</span>
                    <span><strong>Event:</strong> {currentResult.offline.event_title}</span>
                  </div>
                )}
                {currentResult.details && (
                  <div className="text-xs opacity-90 mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                    {currentResult.details.holder_name && (
                      <span><strong>Attendee:</strong> {currentResult.details.holder_name}</span>
                    )}
                    {currentResult.details.ticket_number && (
                      <span><strong>Pass:</strong> {currentResult.details.ticket_number} of {currentResult.details.total_tickets}</span>
                    )}
                    {currentResult.details.ticket_code && (
                      <span><strong>Code:</strong> {currentResult.details.ticket_code}</span>
                    )}
                  </div>
                )}
              </div>

              {/* Simple OK button that dismisses the result and resumes the scanner */}
              <button
                type="button"
                autoFocus
                onClick={handleDismissResult}
                className={`shrink-0 px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-wider text-white transition shadow-sm focus:outline-none focus:ring-2 active:scale-95 ${
                  currentResult.type === "success"
                    ? "bg-green-600 hover:bg-green-500 focus:ring-green-400"
                    : currentResult.type === "wrong_event"
                    ? "bg-amber-600 hover:bg-amber-500 focus:ring-amber-400"
                    : "bg-red-600 hover:bg-red-500 focus:ring-red-400"
                }`}
              >
                OK
              </button>
            </div>
          </div>
        )}

        {/* Recent Scan Log (Last 3) */}
        {scanHistory.length > 0 && (
          <div className="p-4 bg-neutral-950 border-t border-neutral-800 max-h-36 overflow-y-auto">
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-2">
              Recent Scans
            </h4>
            <div className="space-y-1.5">
              {scanHistory.slice(0, 3).map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg bg-neutral-900 border border-neutral-800"
                >
                  <span className="flex items-center gap-1.5 truncate">
                    <span
                      className={`h-2 w-2 rounded-full shrink-0 ${
                        item.type === "success"
                          ? "bg-green-500"
                          : item.type === "wrong_event"
                          ? "bg-amber-500"
                          : "bg-red-500"
                      }`}
                    ></span>
                    <span className="truncate">{item.details?.holder_name || (item.offline ? `${item.offline.serial_label} (offline)` : item.message)}</span>
                  </span>
                  <span className="text-[10px] text-neutral-500 shrink-0 ml-2">{item.timestamp}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-3 border-t border-neutral-800 bg-neutral-900 flex items-center justify-between text-xs text-neutral-400">
          <span>Active: <strong className="text-white">{activeEventTitle}</strong></span>
          <button
            onClick={onClose}
            className="rounded-lg bg-neutral-800 px-4 py-1.5 text-xs font-semibold text-white hover:bg-neutral-700 transition"
          >
            Close Scanner
          </button>
        </div>
      </div>
    </div>
  );
}
