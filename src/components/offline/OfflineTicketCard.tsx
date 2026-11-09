"use client";

import { QRCodeSVG } from "qrcode.react";
import type { EventInfo, SignedTicket } from "@/utils/offlineTypes";
import { eventWhen, eventWhere, money } from "@/utils/offlineFormat";

/**
 * On-screen offline ticket. Same layout as the online ticket card, but strictly BLACK and WHITE
 * (this is what will be printed), and it shows the serial instead of an attendee name.
 * It always looks the same in light and dark mode, because paper has no dark mode.
 */
export default function OfflineTicketCard({
  ticket,
  event,
  batchNumber,
  batchQuantity,
}: {
  ticket: SignedTicket;
  event: EventInfo | null;
  batchNumber: number;
  batchQuantity: number;
}) {
  const inactive = ticket.status !== "generated";
  const where = eventWhere(event);

  return (
    <div className="w-full max-w-[340px] mx-auto overflow-hidden rounded-[18px] border-2 border-black bg-white text-black">
      {/* Header: solid black band, white text */}
      <div className="bg-black px-[22px] py-[20px] text-white">
        <div className="flex items-center justify-between gap-2 text-[11px] font-bold uppercase tracking-[0.18em]">
          <span className="truncate">{ticket.ticket_type}</span>
          <span className="shrink-0">Offline ticket</span>
        </div>
        <h2 className="mt-[12px] mb-[6px] break-words text-[26px] font-extrabold leading-tight text-white">
          {event?.title || "Event"}
        </h2>
        <p className="break-words text-[14px] font-medium leading-snug text-white">
          {eventWhen(event)}
          {where ? ` - ${where}` : ""}
        </p>
      </div>

      {/* Body */}
      <div className="flex flex-col items-center px-[22px] pt-[18px] pb-[20px] text-center">
        <p className="text-[18px] font-extrabold tracking-wide">
          {ticket.ticket_type} <span className="mx-1">|</span> {money(ticket.price)}
        </p>

        {/* Big, plain black QR with a wide white border so it scans easily */}
        <div className="relative my-[14px] flex h-[216px] w-[216px] items-center justify-center rounded-[12px] border-2 border-black bg-white p-[12px]">
          <QRCodeSVG value={ticket.qr} size={188} level="Q" marginSize={0} bgColor="#ffffff" fgColor="#000000" />
          {inactive && (
            <span className="absolute inset-0 flex items-center justify-center bg-white/85 text-[34px] font-black uppercase tracking-widest text-black">
              {ticket.status === "void" ? "VOID" : "USED"}
            </span>
          )}
        </div>

        <p className="text-[36px] font-black leading-none tracking-tight">{ticket.serial_label}</p>
        <p className="mt-[8px] text-[15px] font-extrabold tracking-[0.22em]">CODE {ticket.check_code}</p>
        <p className="mt-[6px] text-[13px] font-medium">
          Batch {batchNumber} - Ticket {ticket.position} of {batchQuantity}
        </p>
      </div>

      {/* Footer */}
      <div className="border-t-2 border-black px-[22px] py-[12px] text-center text-[12px] font-extrabold uppercase tracking-[0.2em]">
        One-time entry only
      </div>
    </div>
  );
}
