"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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

type Busy = "save" | "share" | null;
type Notice = { type: "success" | "error" | "hint"; text: string } | null;

// Keeps the buttons (and their messages) out of the saved ticket picture
function excludeActionArea(domNode: unknown) {
  const el = domNode as { classList?: { contains?: (name: string) => boolean } } | null;
  if (el?.classList && typeof el.classList.contains === "function") {
    if (el.classList.contains("save-ticket-action-area")) {
      return false;
    }
  }
  return true;
}

const errorName = (e: unknown) => (e as { name?: string } | null)?.name;
const errorMessage = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback);

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
  const preparedRef = useRef<File | null>(null);
  const preparingRef = useRef<Promise<File> | null>(null);
  const versionRef = useRef(0);
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [busy, setBusy] = useState<Busy>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [canShareFiles, setCanShareFiles] = useState(false);

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

  const cleanNum = String(ticketNumber || ticketIndex).replace(/[^a-zA-Z0-9_-]/g, "");
  const fileName = `ticket-${cleanNum || ticketIndex}.png`;

  // Work out what this device can do: iPhone/iPad (Photos only reachable through the share
  // sheet's "Save Image") and whether the device can share a picture at all.
  useEffect(() => {
    const ua = navigator.userAgent || "";
    setIsIOS(/iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
    try {
      const probe = new File([new Blob(["x"])], "probe.png", { type: "image/png" });
      setCanShareFiles(
        typeof navigator.share === "function" &&
          typeof navigator.canShare === "function" &&
          navigator.canShare({ files: [probe] })
      );
    } catch {
      setCanShareFiles(false);
    }
  }, []);

  const showNotice = (n: Notice, ms = 4000) => {
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    setNotice(n);
    if (n) {
      noticeTimerRef.current = setTimeout(() => setNotice(null), ms);
    }
  };

  // Draws the whole ticket (header, status chip, QR box, attendee line, footer) as a PNG at 2x
  const renderTicketFile = useCallback(async (): Promise<File> => {
    const node = cardRef.current;
    if (!node) throw new Error("Ticket is not ready yet.");

    const options = {
      pixelRatio: 2,
      cacheBust: true,
      backgroundColor:
        typeof document !== "undefined" && document.documentElement.classList.contains("dark") ? "#1E2028" : "#FFFFFF",
      filter: excludeActionArea,
    };

    // Safari can draw a blank picture on the very first render; a throw-away first pass fixes that
    if (isIOS) {
      try {
        await toBlob(node, options);
      } catch {}
    }

    const blob = await toBlob(node, options);
    if (!blob) throw new Error("Could not generate ticket image.");
    return new File([blob], fileName, { type: "image/png" });
  }, [fileName, isIOS]);

  // Returns the ready-made picture (preparing it if needed). The picture is cached so a tap
  // can hand it to the share sheet immediately, which phones require.
  const getTicketFile = useCallback(async (): Promise<File> => {
    if (preparedRef.current) return preparedRef.current;
    if (!preparingRef.current) {
      const version = versionRef.current;
      preparingRef.current = renderTicketFile()
        .then((file) => {
          // Only keep it if the ticket did not change while it was being drawn
          if (version === versionRef.current) preparedRef.current = file;
          return file;
        })
        .finally(() => {
          preparingRef.current = null;
        });
    }
    return preparingRef.current;
  }, [renderTicketFile]);

  // Whenever the ticket changes (e.g. it was scanned and is now "Used"), forget the old picture.
  // Then prepare a fresh one in the background once the ticket is on screen.
  useEffect(() => {
    versionRef.current += 1;
    preparedRef.current = null;

    const node = cardRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        observer.disconnect();
        timer = setTimeout(() => {
          getTicketFile().catch(() => {});
        }, 400);
      }
    });
    observer.observe(node);

    return () => {
      observer.disconnect();
      if (timer) clearTimeout(timer);
    };
  }, [status, qrValue, eventTitle, eventDate, venue, attendeeName, passType, ticketNumber, ticketIndex, ticketTotal, getTicketFile]);

  useEffect(() => {
    return () => {
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    };
  }, []);

  const downloadFile = (file: File) => {
    const blobUrl = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1500);
  };

  // SAVE TICKET
  //  - Android / computers: downloads the picture (it appears in the gallery / Downloads)
  //  - iPhone / iPad: opens the share sheet, where "Save Image" puts it in Photos
  const handleSave = async () => {
    if (busy) return;
    setBusy("save");
    setNotice(null);

    try {
      if (isIOS && canShareFiles) {
        // The share sheet must be opened straight from the tap, so the picture has to be ready.
        if (!preparedRef.current) {
          await getTicketFile();
          showNotice({ type: "hint", text: "Your ticket is ready. Tap Save Ticket once more." }, 6000);
          return;
        }
        try {
          await navigator.share({ files: [preparedRef.current], title: `${eventTitle} Ticket` });
          return;
        } catch (shareErr) {
          if (errorName(shareErr) === "AbortError") return;
          // Share sheet not available right now: fall through to a normal download
        }
      }

      const file = await getTicketFile();
      downloadFile(file);
      showNotice({
        type: "success",
        text: isIOS ? "✓ Ticket saved to your Files app (Downloads)" : "✓ Ticket saved to your device",
      }, 3500);
    } catch (err) {
      console.error("Save ticket error:", err);
      showNotice({ type: "error", text: errorMessage(err, "Failed to save ticket. Please try again.") });
    } finally {
      setBusy(null);
    }
  };

  // SHARE TICKET: opens the share sheet (WhatsApp, Messages, etc.)
  const handleShare = async () => {
    if (busy) return;
    setBusy("share");
    setNotice(null);

    try {
      const file = await getTicketFile();
      try {
        await navigator.share({ files: [file], title: `${eventTitle} Ticket` });
      } catch (shareErr) {
        if (errorName(shareErr) === "AbortError") return;
        // Sharing failed: download the picture instead so the user still gets it
        downloadFile(file);
        showNotice({ type: "success", text: "✓ Ticket saved to your device" }, 3500);
      }
    } catch (err) {
      console.error("Share ticket error:", err);
      showNotice({ type: "error", text: errorMessage(err, "Failed to share ticket. Please try again.") });
    } finally {
      setBusy(null);
    }
  };

  const buttonClasses =
    "flex-1 py-[12px] px-4 rounded-[10px] bg-[#F3F4F6] dark:bg-[#262933] text-[#1F2430] dark:text-[#ECEDF2] font-semibold text-sm transition hover:bg-neutral-200 dark:hover:bg-[#33363F] focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer disabled:opacity-50";

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

        {/* Save / Share buttons (left out of the saved picture) */}
        <div className="w-full save-ticket-action-area">
          <div className="flex gap-2 mt-[18px]">
            <button
              type="button"
              onClick={handleSave}
              disabled={busy !== null}
              className={buttonClasses}
            >
              {busy === "save" ? "Saving..." : "Save Ticket"}
            </button>

            {/* Share only where the device can share a picture; iPhone uses Save Ticket for this */}
            {!isIOS && canShareFiles && (
              <button
                type="button"
                onClick={handleShare}
                disabled={busy !== null}
                className={buttonClasses}
              >
                {busy === "share" ? "Sharing..." : "Share Ticket"}
              </button>
            )}
          </div>

          {isIOS && canShareFiles && !notice && (
            <p className="text-[11px] text-[#6B7280] dark:text-[#9AA0AE] mt-2 text-center">
              In the menu that opens, tap “Save Image”.
            </p>
          )}

          {notice && (
            <p
              className={`text-xs font-semibold mt-2 text-center animate-in fade-in ${
                notice.type === "success"
                  ? "text-green-600 dark:text-green-400"
                  : notice.type === "error"
                  ? "text-red-500 font-medium"
                  : "text-[#6B7280] dark:text-[#9AA0AE]"
              }`}
            >
              {notice.text}
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
