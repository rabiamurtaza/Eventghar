/**
 * OFFLINE TICKET PDFs (built in the browser from the SAVED tickets, so downloading again
 * never creates anything new - the QR codes are exactly the same every time).
 *
 *  - A4:      4 tickets per page (2 x 2), dotted cut lines, solid black header band.
 *  - Thermal: one ticket per page for receipt printers (80mm or 58mm paper), outlined
 *             header, big QR, pure black and white (no grey, no gradients).
 *
 * Everything is drawn in pure black (0) on white. The QR code is drawn as vector squares,
 * with error correction level Q and a clear white border around it.
 */
import type { BatchData, EventInfo, SignedTicket } from "@/utils/offlineTypes";
import { eventWhen, eventWhere, money } from "@/utils/offlineFormat";

type Doc = import("jspdf").jsPDF;
type QrMatrix = { size: number; get(row: number, col: number): number };

export type ThermalWidth = 58 | 80;

/** The standard PDF fonts only know Latin letters; anything else would print as garbage. */
const safe = (s: string | null | undefined) =>
  String(s ?? "").replace(/[^\x20-\x7E -ÿ–—‘’“”•]/g, "?").trim();

const BLACK = 0;
const WHITE = 255;

async function loadQrCreator() {
  const mod = await import("qrcode");
  const QR = ((mod as unknown as { default?: typeof mod }).default ?? mod) as typeof mod;
  return (text: string): QrMatrix => QR.create(text, { errorCorrectionLevel: "Q" }).modules as unknown as QrMatrix;
}

/** Draws a QR (modules only) in the square at x,y of the given size. The caller keeps the area around it empty. */
function drawQr(doc: Doc, m: QrMatrix, x: number, y: number, size: number) {
  const cell = size / m.size;
  doc.setFillColor(BLACK, BLACK, BLACK);
  for (let row = 0; row < m.size; row++) {
    let col = 0;
    while (col < m.size) {
      if (!m.get(row, col)) {
        col++;
        continue;
      }
      let run = 1;
      while (col + run < m.size && m.get(row, col + run)) run++;
      // a hair of overlap so no white seams show between neighbouring squares in any PDF viewer
      doc.rect(x + col * cell, y + row * cell, run * cell + 0.04, cell + 0.06, "F");
      col += run;
    }
  }
}

function black(doc: Doc) {
  doc.setTextColor(BLACK, BLACK, BLACK);
  doc.setDrawColor(BLACK, BLACK, BLACK);
  doc.setFillColor(BLACK, BLACK, BLACK);
}
function white(doc: Doc) {
  doc.setTextColor(WHITE, WHITE, WHITE);
}

/** Largest size from the list at which the text fits in `maxLines` lines. */
function fit(doc: Doc, text: string, maxWidth: number, sizes: number[], maxLines: number, style: "bold" | "normal") {
  doc.setFont("helvetica", style);
  for (const size of sizes) {
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(text, maxWidth) as string[];
    if (lines.length <= maxLines) return { size, lines };
  }
  const size = sizes[sizes.length - 1];
  doc.setFontSize(size);
  return { size, lines: (doc.splitTextToSize(text, maxWidth) as string[]).slice(0, maxLines) };
}

const PT = 0.3528; // 1pt in mm
const lineH = (size: number, factor = 1.18) => size * PT * factor;

function spaced(doc: Doc, charSpace: number) {
  (doc as unknown as { setCharSpace?: (n: number) => void }).setCharSpace?.(charSpace);
}

/** Letter-spaced text, centred on cx (jsPDF's own "center" ignores the extra spacing, which pushes text left). */
function centerSpaced(doc: Doc, text: string, cx: number, y: number, charSpace: number) {
  const visible = doc.getTextWidth(text) + charSpace * (text.length - 1);
  spaced(doc, charSpace);
  doc.text(text, cx - visible / 2, y);
  spaced(doc, 0);
}

function typePrice(t: SignedTicket) {
  return `${safe(t.ticket_type)}  |  ${money(t.price)}`;
}
function batchLine(t: SignedTicket, quantity: number, batchNumber: number) {
  return `Batch ${batchNumber}  -  Ticket ${t.position} of ${quantity}`;
}

// ============================================================ A4 (4 per page)
function drawA4Ticket(doc: Doc, qr: QrMatrix, data: BatchData, t: SignedTicket, cx: number, cy: number) {
  const m = 5;
  const x0 = cx + m, y0 = cy + m, w = 105 - 2 * m, h = 148.5 - 2 * m;
  const mid = x0 + w / 2;
  const event = data.event as EventInfo | null;

  // frame
  black(doc);
  doc.setLineWidth(0.6);
  doc.rect(x0, y0, w, h, "S");

  // solid black header band with white text
  const title = fit(doc, safe(event?.title) || "Event", w - 12, [17, 15, 13, 11], 2, "bold");
  const when = safe(eventWhen(event));
  const where = safe(eventWhere(event));
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  const subLines = ([when, where].filter(Boolean).flatMap((s) => doc.splitTextToSize(s, w - 12)) as string[]).slice(0, 3);
  const headerH = Math.max(28, 5 + lineH(title.size) * title.lines.length + 2 + subLines.length * lineH(9) + 4.5);

  black(doc);
  doc.rect(x0, y0, w, headerH, "F");
  white(doc);
  doc.setFont("helvetica", "bold");
  let y = y0 + 5;
  doc.setFontSize(title.size);
  title.lines.forEach((line) => {
    y += lineH(title.size) * 0.86;
    doc.text(line, mid, y, { align: "center" });
    y += lineH(title.size) * 0.14;
  });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  y += 1.2;
  subLines.forEach((line) => {
    y += lineH(9) * 0.9;
    doc.text(line, mid, y, { align: "center" });
    y += lineH(9) * 0.1;
  });

  // ticket type | price
  black(doc);
  y = y0 + headerH + 8.5;
  const tp = fit(doc, typePrice(t), w - 10, [14, 12, 10], 1, "bold");
  doc.text(tp.lines[0], mid, y, { align: "center" });

  // QR (46 mm square; at least 4 modules of white all around)
  const qrSize = 44;
  const qrY = y + 4.5;
  drawQr(doc, qr, mid - qrSize / 2, qrY, qrSize);

  // serial, check code, batch line
  doc.setFont("helvetica", "bold");
  doc.setFontSize(27);
  const serialY = qrY + qrSize + 14;
  doc.text(t.serial_label, mid, serialY, { align: "center" });
  doc.setFontSize(12);
  centerSpaced(doc, `CODE  ${t.check_code}`, mid, serialY + 7.5, 0.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(batchLine(t, data.batch.quantity, data.batch.batch_number), mid, serialY + 13, { align: "center" });

  // footer
  doc.setLineWidth(0.4);
  doc.line(x0, y0 + h - 9, x0 + w, y0 + h - 9);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  centerSpaced(doc, "ONE-TIME ENTRY ONLY", mid, y0 + h - 3.2, 0.5);
}

export async function buildA4Pdf(data: BatchData): Promise<Doc> {
  const tickets = printable(data);
  const { jsPDF } = await import("jspdf");
  const makeQr = await loadQrCreator();
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });

  tickets.forEach((t, i) => {
    if (i > 0 && i % 4 === 0) doc.addPage();
    if (i % 4 === 0) {
      // dotted cut lines through the middle of the page
      black(doc);
      doc.setLineWidth(0.25);
      doc.setLineDashPattern([1.2, 1.2], 0);
      doc.line(105, 0, 105, 297);
      doc.line(0, 148.5, 210, 148.5);
      doc.setLineDashPattern([], 0);
    }
    const slot = i % 4;
    drawA4Ticket(doc, makeQr(t.qr), data, t, (slot % 2) * 105, Math.floor(slot / 2) * 148.5);
  });
  return doc;
}

// ====================================================== Thermal (1 per page)
function thermalSpec(width: ThermalWidth) {
  return width === 58
    ? { width: 58, margin: 3, qr: 32, serial: 19, title: [11, 10, 9], small: 8, type: 10.5 }
    : { width: 80, margin: 4, qr: 42, serial: 25, title: [14, 12, 11, 10], small: 8.5, type: 12 };
}

/** Draws one thermal ticket starting at the top of the current page; returns the height used (mm). */
function drawThermalTicket(doc: Doc, qr: QrMatrix, data: BatchData, t: SignedTicket, width: ThermalWidth): number {
  const s = thermalSpec(width);
  const w = s.width - 2 * s.margin;
  const x0 = s.margin;
  const mid = s.width / 2;
  const event = data.event as EventInfo | null;
  let y = s.margin;

  // outlined header (thick black border, no solid fill)
  const title = fit(doc, safe(event?.title) || "Event", w - 5, s.title, 3, "bold");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(s.small);
  const subLines = ([safe(eventWhen(event)), safe(eventWhere(event))].filter(Boolean).flatMap((x) => doc.splitTextToSize(x, w - 5)) as string[]).slice(0, 4);
  const headerH = 3 + lineH(title.size) * title.lines.length + 1.5 + subLines.length * lineH(s.small) + 3;
  black(doc);
  doc.setLineWidth(0.9);
  doc.rect(x0, y, w, headerH, "S");
  let ty = y + 3;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(title.size);
  title.lines.forEach((line) => {
    ty += lineH(title.size) * 0.86;
    doc.text(line, mid, ty, { align: "center" });
    ty += lineH(title.size) * 0.14;
  });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(s.small);
  ty += 1.5;
  subLines.forEach((line) => {
    ty += lineH(s.small) * 0.88;
    doc.text(line, mid, ty, { align: "center" });
    ty += lineH(s.small) * 0.12;
  });
  y += headerH + 3.5;

  // ticket type | price
  const tp = fit(doc, typePrice(t), w, [s.type, s.type - 1.5, s.type - 3], 1, "bold");
  y += lineH(tp.size) * 0.85;
  doc.text(tp.lines[0], mid, y, { align: "center" });
  y += lineH(tp.size) * 0.15;

  // QR with a clear white border of at least 4 modules
  const quiet = (s.qr / qr.size) * 4.5;
  y += 2 + quiet;
  drawQr(doc, qr, mid - s.qr / 2, y, s.qr);
  y += s.qr + quiet;

  // serial (big, bold), check code, batch line
  doc.setFont("helvetica", "bold");
  doc.setFontSize(s.serial);
  y += lineH(s.serial) * 0.85;
  doc.text(t.serial_label, mid, y, { align: "center" });
  y += lineH(s.serial) * 0.15 + 1.5;
  doc.setFontSize(10);
  y += lineH(10) * 0.85;
  centerSpaced(doc, `CODE  ${t.check_code}`, mid, y, 0.4);
  y += lineH(10) * 0.15 + 0.5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(s.small);
  const bl = fit(doc, batchLine(t, data.batch.quantity, data.batch.batch_number), w, [s.small, s.small - 0.5], 1, "normal");
  y += lineH(s.small) * 0.85;
  doc.text(bl.lines[0], mid, y, { align: "center" });
  y += lineH(s.small) * 0.15 + 2.5;

  // footer
  doc.setLineWidth(0.4);
  doc.line(x0, y, x0 + w, y);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(s.small);
  y += 1.8 + lineH(s.small) * 0.85;
  centerSpaced(doc, "ONE-TIME ENTRY ONLY", mid, y, 0.4);
  y += lineH(s.small) * 0.15 + s.margin + 1;
  return y;
}

export async function buildThermalPdf(data: BatchData, width: ThermalWidth = 80): Promise<Doc> {
  const tickets = printable(data);
  const { jsPDF } = await import("jspdf");
  const makeQr = await loadQrCreator();
  const w = thermalSpec(width).width;

  // First measure how tall one ticket is (they are all the same height), then draw them all
  const probe = new jsPDF({ unit: "mm", format: [w, 400], orientation: "portrait" });
  black(probe);
  const height = Math.ceil(drawThermalTicket(probe, makeQr(tickets[0].qr), data, tickets[0], width) * 10) / 10;

  const doc = new jsPDF({ unit: "mm", format: [w, height], orientation: "portrait" });
  tickets.forEach((t, i) => {
    if (i > 0) doc.addPage([w, height], "portrait");
    black(doc);
    doc.setLineDashPattern([], 0);
    drawThermalTicket(doc, makeQr(t.qr), data, t, width);
  });
  return doc;
}

// ================================================================== helpers
/** Voided tickets are never printed again. */
function printable(data: BatchData): SignedTicket[] {
  const tickets = data.tickets.filter((t) => t.status !== "void");
  if (tickets.length === 0) throw new Error("Every ticket in this batch has been voided, so there is nothing to print.");
  return tickets;
}

function fileName(data: BatchData, kind: string) {
  const slug = (safe(data.event?.title) || "event").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
  return `${slug || "event"}-offline-batch${data.batch.batch_number}-${kind}.pdf`;
}

export async function downloadA4Pdf(data: BatchData) {
  (await buildA4Pdf(data)).save(fileName(data, "a4"));
}

export async function downloadThermalPdf(data: BatchData, width: ThermalWidth) {
  (await buildThermalPdf(data, width)).save(fileName(data, `thermal-${width}mm`));
}
