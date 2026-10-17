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
  type: "success" | "wrong_event" | "already_used" | "invalid";
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
      const scanner = html5QrCodeRef.current;
      if (scanner) {
        html5QrCodeRef.current = null;
        try {
          if (scanner.isPaused?.()) {
            try { scanner.resume(); } catch (e) {}
          }
          if (scanner.isScanning) {
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

  // Keyboard shortcut (Enter, Space, Escape) to dismiss the result card and return to scanning
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
    setCurrentResult(null);

    // 400ms cooldown ensures user pulls the phone/ticket away before scanner re-enables
    setTimeout(() => {
      if (isMountedRef.current) {
        try {
          const scanner = html5QrCodeRef.current;
          if (scanner && typeof scanner.resume === "function") {
            if (scanner.isPaused?.()) {
              scanner.resume();
            }
          }
        } catch (resumeErr) {
          console.warn("Could not resume camera scanner:", resumeErr);
        }
        isScanLockedRef.current = false;
        setIsProcessing(false);
      }
    }, 400);
  };

  const handleDecodedText = async (decodedText: string) => {
    // 1. Synchronous lock check: immediately blocks concurrent or duplicate frames
    if (isScanLockedRef.current) return;
    isScanLockedRef.current = true;
    setIsProcessing(true);

    // 2. Pause camera scanner immediately so it stops analyzing frames
    try {
      const scanner = html5QrCodeRef.current;
      if (scanner && typeof scanner.pause === "function") {
        if (!scanner.isPaused?.()) {
          scanner.pause(true);
        }
      }
    } catch (pauseErr) {
      console.warn("Could not pause camera scanner:", pauseErr);
    }

    const supabase = createClient();
    const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

    try {
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

      // 4. Check Event Matching
      // If selectedEventId is set, verify that ticket belongs to this event
      if (selectedEventId && parsed.event_id && parsed.event_id !== selectedEventId) {
        playErrorBuzzer();
        const activeEventObj = eventsList.find((e) => e.id === selectedEventId);
        const activeName = fixedEventTitle || activeEventObj?.title || "Active Event";
        const scannedEventName = parsed.event_title || "Another Event";

        const res: ScanResult = {
          type: "wrong_event",
          message: `Wrong Event! This ticket belongs to "${scannedEventName}", not "${activeName}".`,
          details: {
            event_title: scannedEventName,
            holder_name: parsed.holder_name,
            ticket_code: parsed.ticket_code,
            ticket_number: parsed.ticket_number,
            total_tickets: parsed.total_tickets,
          },
          timestamp: timeStr,
        };
        setCurrentResult(res);
        setScanHistory((prev) => [res, ...prev.slice(0, 9)]);
        return;
      }

      // 5. Database Check
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
        .single();

      if (error || !ticket) {
        playErrorBuzzer();
        const res: ScanResult = {
          type: "invalid",
          message: "Ticket not found in the database. Please verify booking.",
          details: {
            holder_name: parsed.holder_name,
            ticket_code: parsed.ticket_code,
          },
          timestamp: timeStr,
        };
        setCurrentResult(res);
        setScanHistory((prev) => [res, ...prev.slice(0, 9)]);
        return;
      }

      // 6. Check if already used
      if (ticket.status === "used") {
        playErrorBuzzer();
        const scannedTimeFormatted = ticket.scanned_at
          ? new Date(ticket.scanned_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
          : "earlier";

        const res: ScanResult = {
          type: "already_used",
          message: `Ticket Already Used! Scanned at ${scannedTimeFormatted}.`,
          details: {
            holder_name: ticket.holder_name,
            ticket_code: ticket.ticket_code,
            ticket_number: ticket.ticket_number,
            total_tickets: ticket.total_tickets,
            scanned_at: ticket.scanned_at,
          },
          timestamp: timeStr,
        };
        setCurrentResult(res);
        setScanHistory((prev) => [res, ...prev.slice(0, 9)]);
        return;
      }

      // 7. Valid Entry! Mark ticket as 'used'
      const { data: { session } } = await supabase.auth.getSession();
      const nowIso = new Date().toISOString();

      await supabase
        .from("issued_tickets")
        .update({
          status: "used",
          scanned_at: nowIso,
          scanned_by: session?.user?.id || null,
        })
        .eq("id", ticket.id);

      playSuccessChime();
      const res: ScanResult = {
        type: "success",
        message: "VALID ENTRY (Admitted)",
        details: {
          holder_name: ticket.holder_name,
          ticket_code: ticket.ticket_code,
          ticket_number: ticket.ticket_number,
          total_tickets: ticket.total_tickets,
          ticket_type: ticket.ticket_type,
          event_title: ticket.events?.title,
          scanned_at: nowIso,
        },
        timestamp: timeStr,
      };
      setCurrentResult(res);
      setScanHistory((prev) => [res, ...prev.slice(0, 9)]);

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative max-h-[95vh] max-w-lg w-full bg-neutral-900 border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col text-white"
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
            <div className="relative w-full max-w-[300px] aspect-square rounded-2xl overflow-hidden border-2 border-indigo-500/50 shadow-inner bg-neutral-950">
              <div id="qr-camera-feed" className="w-full h-full object-cover"></div>

              {/* Viewfinder Target Overlay */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-48 h-48 border-2 border-dashed border-indigo-400/70 rounded-xl animate-pulse"></div>
              </div>

              {isProcessing && !currentResult && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center text-xs font-bold text-white">
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
                  : currentResult.type === "already_used"
                  ? "✕"
                  : currentResult.type === "wrong_event"
                  ? "⚠️"
                  : "!"}
              </div>

              <div className="overflow-hidden flex-1 min-w-0">
                <div className="font-extrabold text-sm sm:text-base leading-tight">
                  {currentResult.message}
                </div>
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
                    <span className="truncate">{item.details?.holder_name || item.message}</span>
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
