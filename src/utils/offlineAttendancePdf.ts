/**
 * The offline gate attendance list as a printable PDF (black and white, plain table).
 * Built in the browser from the list on screen.
 */
import type { AttendanceRow } from "@/utils/offlineTypes";
import { formatStamp, moneyTotal, serialText } from "@/utils/offlineFormat";

/** The standard PDF fonts only know Latin letters. */
const safe = (s: string | null | undefined) =>
  String(s ?? "").replace(/[^\x20-\x7E -ÿ–—‘’“”•]/g, "?").trim();

const STATUS_LABEL: Record<string, string> = { checked_in: "Scanned", generated: "Not scanned", void: "Void" };

export async function downloadAttendancePdf(input: {
  eventTitle: string;
  filterLabel: string;
  rows: AttendanceRow[];
  batchNumbers: Map<string, number>;
  summary: { scanned: number; valid: number; void: number; cash: number };
}) {
  const { jsPDF } = await import("jspdf");
  const mod = await import("jspdf-autotable");
  const autoTable = ((mod as unknown as { default?: unknown }).default ?? (mod as unknown as { autoTable: unknown }).autoTable) as (
    doc: unknown,
    options: unknown
  ) => void;

  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("Offline tickets - gate attendance", 14, 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(safe(input.eventTitle) || "Event", 14, 22);
  doc.text(`Showing: ${input.filterLabel}   |   Printed: ${formatStamp(new Date().toISOString())}`, 14, 27);
  doc.text(
    `Scanned ${input.summary.scanned} of ${input.summary.valid} valid tickets   |   Void ${input.summary.void}   |   Cash to collect ${moneyTotal(input.summary.cash)}`,
    14,
    32
  );

  autoTable(doc, {
    startY: 37,
    head: [["Serial", "Batch", "Type", "Price", "Status", "Scanned at"]],
    body: input.rows.map((r) => [
      serialText(r.serial),
      String(input.batchNumbers.get(r.batch_id) ?? ""),
      safe(r.ticket_type),
      moneyTotal(r.price),
      STATUS_LABEL[r.status] ?? r.status,
      r.checked_in_at ? formatStamp(r.checked_in_at) : "",
    ]),
    styles: { fontSize: 9, textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.15, cellPadding: 1.8 },
    headStyles: { fillColor: [0, 0, 0], textColor: [255, 255, 255], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [255, 255, 255] },
  });

  const slug = (safe(input.eventTitle) || "event").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
  doc.save(`${slug || "event"}-offline-attendance.pdf`);
}
