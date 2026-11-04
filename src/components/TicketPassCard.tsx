"use client";

import { useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { toBlob } from "html-to-image";

export interface TicketPassProps {
  passType: string;
  ticketNumber: number | string;
  eventTitle: string;
  eventDate: string;
  venue: string;
  attendeeName: string;
  status: "valid" | "used" | "expired";
  qrValue: string;
  ticketIndex: number;
  ticketTotal: number;
}

export default function TicketPassCard({
  passType,
  ticketNumber,
  eventTitle,
  eventDate,
  venue,
  attendeeName,
  status = "valid",
  qrValue,
  ticketIndex,
  ticketTotal,
}: TicketPassProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isInactive = status === "used" || status === "expired";

  const statusLabel = status === "used" ? "Used" : status === "expired" ? "Expired" : "Valid for entry";

  const statusChipClasses = isInactive
    ? "bg-[#E5E7EB] dark:bg-[#262933] border border-[#D1D5DB] dark:border-[#33363F] text-[#6B7280] dark:text-[#9AA0AE]"
    : "bg-[#F3F4F6] dark:bg-[#14151A] border border-[#E5E7EB] dark:border-[#33363F] text-[#1F2430] dark:text-[#ECEDF2]";

  const displayPassType = passType
    ? passType.trim().toLowerCase().endsWith("pass")
      ? passType.trim()
      : `${passType.trim()} Pass`
    : "Standard Pass";

  const displayTicketNumber = String(ticketNumber).startsWith("#")
    ? ticketNumber
    : `#${ticketNumber}`;

  const handleSaveTicket = async () => {
    if (!cardRef.current || saveStatus === "saving") return;

    setSaveStatus("saving");
    setErrorMsg(null);

    try {
      // Render entire card (header, status chip, QR box, attendee line, footer) at 2x resolution
      const blob = await toBlob(cardRef.current, {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: typeof document !== "undefined" && document.documentElement.classList.contains("dark") ? "#1E2028" : "#FFFFFF",
        filter: (domNode: any) => {
          // exclude the save button action area from the saved ticket image
          if (domNode?.classList && typeof domNode.classList.contains === "function") {
            if (domNode.classList.contains("save-ticket-action-area")) {
              return false;
            }
          }
          return true;
        },
      });

      if (!blob) {
        throw new Error("Could not generate ticket image.");
      }

      const cleanNum = String(ticketNumber || ticketIndex).replace(/[^a-zA-Z0-9_-]/g, "");
      const fileName = `ticket-${cleanNum || ticketIndex}.png`;
      const file = new File([blob], fileName, { type: "image/png" });

      // Mobile: Use Web Share API if supported
      if (typeof navigator !== "undefined" && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: `${eventTitle} Ticket`,
          });
          setSaveStatus("saved");
          setTimeout(() => setSaveStatus("idle"), 2500);
          return;
        } catch (shareErr: any) {
          if (shareErr.name === "AbortError") {
            setSaveStatus("idle");
            return;
          }
        }
      }

      // Desktop / Fallback direct download
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);

      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2500);
    } catch (err: any) {
      console.error("Save ticket error:", err);
      setSaveStatus("error");
      setErrorMsg(err.message || "Failed to save ticket. Please try again.");
      setTimeout(() => {
        setSaveStatus("idle");
        setErrorMsg(null);
      }, 4000);
    }
  };

  return (
    <div
      ref={cardRef}
      className="w-full max-w-[340px] mx-auto bg-white dark:bg-[#1E2028] border border-[#E5E7EB] dark:border-[#33363F] rounded-[18px] overflow-hidden flex flex-col shrink-0 h-auto shadow-none"
    >
      {/* 1. Header with Gradient */}
      <div className="bg-[linear-gradient(135deg,#4F46E5,#9B1CF5)] text-white p-[20px_22px]">
        <div className="flex items-center justify-between text-[13px] font-semibold text-white">
          <span className="truncate pr-2">{displayPassType}</span>
          <span className="shrink-0">{displayTicketNumber}</span>
        </div>
        <h2 className="text-[28px] font-bold text-white leading-tight break-words mt-[12px] mb-[6px]">
          {eventTitle}
        </h2>
        <p className="text-[14px] text-white/90 break-words leading-snug">
          {eventDate}
          {venue ? `, ${venue}` : ""}
        </p>
      </div>

      {/* 2. Body */}
      <div className="p-[22px] flex flex-col items-center text-center">
        {/* Status Chip */}
        <div
          className={`inline-flex items-center justify-center rounded-full text-[14px] font-semibold py-[6px] px-[14px] ${statusChipClasses}`}
        >
          {statusLabel}
        </div>

        {/* 200x200 QR Box */}
        <div className="w-[200px] h-[200px] min-w-[200px] min-h-[200px] bg-white rounded-[12px] border border-[#E5E7EB] p-[10px] my-0 mt-[18px] mb-[14px] mx-auto flex items-center justify-center">
          <div
            style={{ opacity: isInactive ? 0.35 : 1 }}
            className="flex items-center justify-center w-full h-full"
          >
            <QRCodeSVG value={qrValue} size={180} level="M" marginSize={0} />
          </div>
        </div>

        {/* Attendee Line (No visible code line) */}
        <p className="text-[15px] break-words text-center leading-snug">
          <span className="text-[#6B7280] dark:text-[#9AA0AE]">Attendee: </span>
          <strong className="font-bold text-[#1F2430] dark:text-[#ECEDF2]">
            {attendeeName}
          </strong>
        </p>

        {/* Save Ticket Button Area */}
        <div className="w-full save-ticket-action-area">
          <button
            type="button"
            onClick={handleSaveTicket}
            disabled={saveStatus === "saving"}
            className="w-full mt-[18px] py-[12px] px-4 rounded-[10px] bg-[#F3F4F6] dark:bg-[#262933] text-[#1F2430] dark:text-[#ECEDF2] font-semibold text-sm transition hover:bg-neutral-200 dark:hover:bg-[#33363F] focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer disabled:opacity-50"
          >
            {saveStatus === "saving" ? "Saving..." : "Save Ticket"}
          </button>

          {saveStatus === "saved" && (
            <p className="text-xs font-semibold text-green-600 dark:text-green-400 mt-2 text-center animate-in fade-in">
              ✓ Ticket saved
            </p>
          )}

          {saveStatus === "error" && errorMsg && (
            <p className="text-xs font-medium text-red-500 mt-2 text-center animate-in fade-in">
              {errorMsg}
            </p>
          )}
        </div>
      </div>

      {/* 3. Footer */}
      <div className="border-t border-[#E5E7EB] dark:border-[#33363F] p-[14px_22px] flex items-center justify-between text-[13px] text-[#6B7280] dark:text-[#9AA0AE]">
        <span>One-time entry only</span>
        <span>
          Ticket {ticketIndex} of {ticketTotal}
        </span>
      </div>
    </div>
  );
}
