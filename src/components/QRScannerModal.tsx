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
    holder_email?: string;
    holder_phone?: string;
    ticket_code?: string;
    ticket_number?: number;
    total_tickets?: number;
    ticket_type?: string;
    event_title?: string;
    event_number?: number | string;
    start_date?: string;
    start_time?: string;
    venue_name?: string;
    city?: string;
    scanned_at?: string;
    raw_code?: string;
    active_event_title?: string;
  };
  timestamp: string;
}

function formatDate(dateStr?: string) {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-US", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function formatTime(timeStr?: string) {
  if (!timeStr) return null;
  try {
    const parts = timeStr.split(":");
    if (parts.length >= 2) {
      let hours = parseInt(parts[0], 10);
      const minutes = parts[1];
      const ampm = hours >= 12 ? "PM" : "AM";
      hours = hours % 12 || 12;
      return `${hours}:${minutes} ${ampm}`;
    }
    return timeStr;
  } catch {
    return timeStr;
  }
}

function formatDateTime(isoStr?: string) {
  if (!isoStr) return null;
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    return d.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      day: "numeric",
      month: "short",
    });
  } catch {
    return isoStr;
  }
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
      const scanner = html5QrCodeRef.current;
      if (scanner) {
        html5QrCodeRef.current = null;
        try {
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

  // Handle keyboard shortcut (Enter, Space, Escape) to dismiss result and return to scanner
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
    // Cooldown prevents immediate re-scan of the same code before user withdraws ticket
    setTimeout(() => {
      if (isMountedRef.current) {
        setIsProcessing(false);
      }
    }, 350);
  };

  const handleDecodedText = async (decodedText: string) => {
    if (isProcessing) return;
    setIsProcessing(true);

    const supabase = createClient();
    const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

    try {
      // 1. Parse JSON payload
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
          details: {
            raw_code: typeof decodedText === "string" ? decodedText.slice(0, 100) : undefined,
          },
          timestamp: timeStr,
        };
        setCurrentResult(res);
        setScanHistory((prev) => [res, ...prev.slice(0, 9)]);
        return;
      }

      // 2. Check Event Matching
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
            active_event_title: activeName,
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

      // 3. Database Check
      const { data: ticket, error } = await supabase
        .from("issued_tickets")
        .select(`
          *,
          events (
            id,
            title,
            event_number,
            start_date,
            start_time,
            venue_name,
            city
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
            ticket_code: parsed.ticket_code || parsed.ticket_id,
            event_title: parsed.event_title,
          },
          timestamp: timeStr,
        };
        setCurrentResult(res);
        setScanHistory((prev) => [res, ...prev.slice(0, 9)]);
        return;
      }

      // 4. Check if already used
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
            holder_email: ticket.holder_email,
            holder_phone: ticket.holder_phone,
            ticket_code: ticket.ticket_code,
            ticket_number: ticket.ticket_number,
            total_tickets: ticket.total_tickets,
            ticket_type: ticket.ticket_type,
            event_title: ticket.events?.title || parsed.event_title,
            event_number: ticket.events?.event_number,
            start_date: ticket.events?.start_date,
            start_time: ticket.events?.start_time,
            venue_name: ticket.events?.venue_name,
            city: ticket.events?.city,
            scanned_at: ticket.scanned_at,
          },
          timestamp: timeStr,
        };
        setCurrentResult(res);
        setScanHistory((prev) => [res, ...prev.slice(0, 9)]);
        return;
      }

      // 5. Valid Entry! Mark ticket as 'used'
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
          holder_email: ticket.holder_email,
          holder_phone: ticket.holder_phone,
          ticket_code: ticket.ticket_code,
          ticket_number: ticket.ticket_number,
          total_tickets: ticket.total_tickets,
          ticket_type: ticket.ticket_type,
          event_title: ticket.events?.title || parsed.event_title,
          event_number: ticket.events?.event_number,
          start_date: ticket.events?.start_date,
          start_time: ticket.events?.start_time,
          venue_name: ticket.events?.venue_name,
          city: ticket.events?.city,
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

        {/* Recent Scan Log (Last 3) */}
        {scanHistory.length > 0 && !currentResult && (
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

        {/* Scan Result Overlay Modal with Full Details & Single OK Button */}
        {currentResult && (
          <div className="absolute inset-0 z-30 bg-neutral-950/98 backdrop-blur-md flex flex-col justify-between overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Top Status Header */}
            <div
              className={`p-4 sm:p-5 border-b flex items-start gap-3.5 ${
                currentResult.type === "success"
                  ? "bg-green-950/80 border-green-700 text-green-100"
                  : currentResult.type === "already_used"
                  ? "bg-red-950/80 border-red-700 text-red-100"
                  : currentResult.type === "wrong_event"
                  ? "bg-amber-950/80 border-amber-700 text-amber-100"
                  : "bg-red-950/80 border-red-700 text-red-100"
              }`}
            >
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-xl font-bold shadow-md ${
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

              <div className="flex-1 min-w-0">
                <div className="font-extrabold text-base sm:text-lg leading-snug">
                  {currentResult.message}
                </div>
                <div className="text-xs opacity-80 mt-0.5">
                  Scanned at {currentResult.timestamp}
                </div>
              </div>
            </div>

            {/* Scrollable Details Section */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-3.5 flex-1 text-xs">
              {/* Attendee Details */}
              <div className="rounded-2xl bg-neutral-900/90 border border-neutral-800 p-3.5 shadow-sm">
                <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 mb-2 flex items-center gap-1.5">
                  <span>👤</span> Attendee Details
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <span className="text-neutral-500 block text-[11px]">Full Name:</span>
                    <span className="font-semibold text-white text-sm">
                      {currentResult.details?.holder_name || "N/A"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Ticket Details */}
              <div className="rounded-2xl bg-neutral-900/90 border border-neutral-800 p-3.5 shadow-sm">
                <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 mb-2 flex items-center gap-1.5">
                  <span>🎟️</span> Ticket Details
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <span className="text-neutral-500 block text-[11px]">Ticket Code:</span>
                    <span className="font-mono font-semibold text-purple-300 select-all">
                      {currentResult.details?.ticket_code || "N/A"}
                    </span>
                  </div>
                  <div>
                    <span className="text-neutral-500 block text-[11px]">Pass:</span>
                    <span className="font-semibold text-white">
                      {currentResult.details?.ticket_number
                        ? `Pass ${currentResult.details.ticket_number} of ${currentResult.details.total_tickets || 1}`
                        : "Standard Pass"}
                    </span>
                  </div>
                  <div>
                    <span className="text-neutral-500 block text-[11px]">Ticket Type:</span>
                    <span className="font-semibold text-white">
                      {currentResult.details?.ticket_type || "Standard"}
                    </span>
                  </div>
                  <div>
                    <span className="text-neutral-500 block text-[11px]">Status:</span>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        currentResult.type === "success"
                          ? "bg-green-500/20 text-green-400 border border-green-500/30"
                          : currentResult.type === "already_used"
                          ? "bg-red-500/20 text-red-400 border border-red-500/30"
                          : currentResult.type === "wrong_event"
                          ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                          : "bg-red-500/20 text-red-400 border border-red-500/30"
                      }`}
                    >
                      {currentResult.type === "success"
                        ? "Admitted"
                        : currentResult.type === "already_used"
                        ? "Already Used"
                        : currentResult.type === "wrong_event"
                        ? "Wrong Event"
                        : "Invalid"}
                    </span>
                  </div>
                  {currentResult.details?.scanned_at && (
                    <div className="col-span-2 pt-1 border-t border-neutral-800/60">
                      <span className="text-neutral-500 block text-[11px]">Scanned At:</span>
                      <span className="text-neutral-300">
                        {formatDateTime(currentResult.details.scanned_at) || currentResult.details.scanned_at}
                      </span>
                    </div>
                  )}
                  {currentResult.details?.raw_code && (
                    <div className="col-span-2 pt-1 border-t border-neutral-800/60">
                      <span className="text-neutral-500 block text-[11px]">Scanned Payload:</span>
                      <span className="text-neutral-400 font-mono text-[11px] break-all">
                        {currentResult.details.raw_code}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Event Details */}
              <div className="rounded-2xl bg-neutral-900/90 border border-neutral-800 p-3.5 shadow-sm">
                <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 mb-2 flex items-center gap-1.5">
                  <span>📅</span> Event Details
                </div>
                <div className="space-y-2">
                  <div>
                    <span className="text-neutral-500 block text-[11px]">Event Title:</span>
                    <span className="font-bold text-white text-sm">
                      {currentResult.details?.event_number ? `#${currentResult.details.event_number} - ` : ""}
                      {currentResult.details?.event_title || activeEventTitle}
                    </span>
                  </div>

                  {currentResult.details?.active_event_title && (
                    <div>
                      <span className="text-neutral-500 block text-[11px]">Expected Active Event:</span>
                      <span className="text-amber-300 font-medium">
                        {currentResult.details.active_event_title}
                      </span>
                    </div>
                  )}

                  {(currentResult.details?.start_date || currentResult.details?.start_time) && (
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      {currentResult.details.start_date && (
                        <div>
                          <span className="text-neutral-500 block text-[11px]">Date:</span>
                          <span className="text-neutral-200">
                            {formatDate(currentResult.details.start_date)}
                          </span>
                        </div>
                      )}
                      {currentResult.details.start_time && (
                        <div>
                          <span className="text-neutral-500 block text-[11px]">Time:</span>
                          <span className="text-neutral-200">
                            {formatTime(currentResult.details.start_time)}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {(currentResult.details?.venue_name || currentResult.details?.city) && (
                    <div className="pt-1">
                      <span className="text-neutral-500 block text-[11px]">Venue & Location:</span>
                      <span className="text-neutral-200">
                        {currentResult.details.venue_name
                          ? `${currentResult.details.venue_name}${currentResult.details.city ? `, ${currentResult.details.city}` : ""}`
                          : currentResult.details.city}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Contact Details */}
              {(currentResult.details?.holder_email || currentResult.details?.holder_phone) && (
                <div className="rounded-2xl bg-neutral-900/90 border border-neutral-800 p-3.5 shadow-sm">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 mb-2 flex items-center gap-1.5">
                    <span>📞</span> Contact Details
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {currentResult.details.holder_email && (
                      <div>
                        <span className="text-neutral-500 block text-[11px]">Email Address:</span>
                        <span className="text-neutral-200 truncate block font-medium">
                          {currentResult.details.holder_email}
                        </span>
                      </div>
                    )}
                    {currentResult.details.holder_phone && (
                      <div>
                        <span className="text-neutral-500 block text-[11px]">Phone Number:</span>
                        <span className="text-neutral-200 font-medium">
                          {currentResult.details.holder_phone}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Single OK Button Footer */}
            <div className="p-4 border-t border-neutral-800 bg-neutral-900/90 flex-shrink-0">
              <button
                type="button"
                autoFocus
                onClick={handleDismissResult}
                className={`w-full py-3.5 px-6 rounded-2xl font-bold text-base text-white transition-all duration-150 shadow-lg flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-neutral-950 active:scale-[0.99] ${
                  currentResult.type === "success"
                    ? "bg-green-600 hover:bg-green-500 focus:ring-green-500 shadow-green-950/50"
                    : currentResult.type === "wrong_event"
                    ? "bg-amber-600 hover:bg-amber-500 focus:ring-amber-500 shadow-amber-950/50"
                    : "bg-red-600 hover:bg-red-500 focus:ring-red-500 shadow-red-950/50"
                }`}
              >
                <span>OK</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
