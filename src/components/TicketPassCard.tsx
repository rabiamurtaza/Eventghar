"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { buildQRPayload } from "@/utils/ticketService";

interface TicketPassCardProps {
  booking: any;
  passes: any[];
}

export default function TicketPassCard({ booking, passes }: TicketPassCardProps) {
  const [activePassIndex, setActivePassIndex] = useState(0);

  // If no issued passes exist yet, show a fallback waiting message
  if (!passes || passes.length === 0) {
    return (
      <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 text-center shadow-sm">
        <h3 className="font-bold text-neutral-900 dark:text-white text-base">
          {booking.event?.title || "Event Ticket"}
        </h3>
        <p className="text-xs text-neutral-500 mt-1">
          Your booking is verified. Tickets are being issued.
        </p>
      </div>
    );
  }

  const currentPass = passes[activePassIndex] || passes[0];
  const qrValue = buildQRPayload(currentPass, booking.event?.title);

  const downloadQR = () => {
    const svg = document.getElementById(`qr-svg-${currentPass.id}`);
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width + 40;
      canvas.height = img.height + 40;
      if (ctx) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 20, 20);
        const a = document.createElement("a");
        a.download = `ticket-${currentPass.ticket_code}.png`;
        a.href = canvas.toDataURL("image/png");
        a.click();
      }
    };
    img.src = "data:image/svg+xml;base64," + btoa(svgData);
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-md flex flex-col">
      
      {/* Card Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-5 text-white">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded backdrop-blur-xs">
            {currentPass.ticket_type || "Standard"} Pass
          </span>
          {booking.event?.event_number && (
            <span className="text-xs font-bold bg-black/20 px-2 py-0.5 rounded">
              #{booking.event.event_number}
            </span>
          )}
        </div>
        <h3 className="mt-2 text-lg font-black tracking-tight line-clamp-1">
          {booking.event?.title || "Event Pass"}
        </h3>
        <p className="text-xs text-indigo-100 mt-0.5">
          {booking.event?.start_date ? new Date(booking.event.start_date).toLocaleDateString() : "Date TBD"} • {booking.event?.venue_name || "Venue TBD"}
        </p>
      </div>

      {/* Multiple Tickets Tab Switcher (if user booked > 1 ticket) */}
      {passes.length > 1 && (
        <div className="p-3 bg-neutral-100 dark:bg-neutral-950/60 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-center gap-2">
          {passes.map((pass, index) => {
            const isSelected = index === activePassIndex;
            return (
              <button
                key={pass.id}
                onClick={() => setActivePassIndex(index)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                  isSelected
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
                }`}
              >
                <span>Pass {index + 1} of {passes.length}</span>
                {pass.status === "used" && (
                  <span className="h-1.5 w-1.5 rounded-full bg-neutral-400"></span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* QR Code and Pass Details */}
      <div className="p-6 flex flex-col items-center justify-center text-center">
        
        {/* Pass Status Banner */}
        <div className="mb-4">
          {currentPass.status === "used" ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 dark:bg-neutral-800 px-3 py-1 text-xs font-bold text-neutral-500 border border-neutral-200 dark:border-neutral-700">
              ✓ Used / Scanned at Gate
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 dark:bg-green-900/30 px-3 py-1 text-xs font-bold text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800/40">
              <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
              Ready for Gate Scan (Admit 1)
            </span>
          )}
        </div>

        {/* The QR Code */}
        <div className="p-4 bg-white rounded-2xl border-2 border-neutral-100 shadow-inner inline-block">
          <QRCodeSVG
            id={`qr-svg-${currentPass.id}`}
            value={qrValue}
            size={180}
            level="M"
            marginSize={2}
          />
        </div>

        {/* Ticket Code & Attendee */}
        <div className="mt-4">
          <div className="font-mono text-sm font-black text-neutral-900 dark:text-white tracking-wider">
            {currentPass.ticket_code}
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            Attendee: <strong className="text-neutral-800 dark:text-neutral-200">{currentPass.holder_name}</strong>
          </p>
        </div>

        {/* Action Button */}
        <div className="mt-5 w-full flex items-center justify-center gap-2">
          <button
            onClick={downloadQR}
            className="w-full max-w-xs rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 py-2.5 text-xs font-bold transition flex items-center justify-center gap-1.5"
          >
            <span>⬇️</span> Save / Download QR
          </button>
        </div>

      </div>

      {/* Card Footer Tear-off Style */}
      <div className="px-5 py-3 bg-neutral-50 dark:bg-neutral-950/80 border-t border-dashed border-neutral-200 dark:border-neutral-800 flex items-center justify-between text-[11px] text-neutral-400">
        <span>One-time entry only</span>
        <span>Ticket {currentPass.ticket_number} of {currentPass.total_tickets}</span>
      </div>

    </div>
  );
}
