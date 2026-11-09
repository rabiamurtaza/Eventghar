/**
 * OFFLINE TICKET QR: sealing and checking. SERVER ONLY.
 *
 * The QR of an offline ticket contains only:   OFF.<ticket id>.<seal>
 * The "seal" is a tamper-proof stamp made from the ticket id and the event id with a
 * secret key (OFFLINE_QR_SECRET) that only the server knows. Nobody can invent a ticket
 * or change a letter of a QR without the secret, so such QR codes fail the check.
 *
 * This file uses Node's crypto, so it can only be imported by server code (route
 * handlers). It must never be imported by a page or component that runs in the browser.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export class OfflineSetupError extends Error {
  constructor() {
    super("Offline tickets are not set up yet (missing OFFLINE_QR_SECRET).");
    this.name = "OfflineSetupError";
  }
}

const SEAL_BYTES = 16; // 128 bits -> 22 characters: small QR, still impossible to guess
const CHECK_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I - easy to read aloud
const CHECK_LENGTH = 5;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const QR_RE = /^OFF\.([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.([A-Za-z0-9_-]{22})$/;

function secret(): string {
  const value = process.env.OFFLINE_QR_SECRET;
  if (!value || value.length < 32) throw new OfflineSetupError();
  return value;
}

/** Throws OfflineSetupError if the secret is missing. Called BEFORE any ticket is created. */
export function assertOfflineConfigured(): void {
  secret();
}

function mac(purpose: "seal" | "check", ticketId: string, eventId: string): Buffer {
  return createHmac("sha256", secret()).update(`${purpose}:${ticketId}:${eventId}`).digest();
}

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export const isUuid = (v: unknown): v is string => typeof v === "string" && UUID_RE.test(v);

/** 1 -> "OFF-0001" */
export function serialLabel(serial: number): string {
  return `OFF-${String(serial).padStart(4, "0")}`;
}

/** Accepts "OFF-0007", "off0007", "0007" or "7" -> 7 (or null if it is not a serial). */
export function parseSerialInput(input: unknown): number | null {
  const m = String(input ?? "").trim().match(/^(?:OFF[-\s]?)?0*(\d{1,6})$/i);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return n > 0 ? n : null;
}

/** The secret seal (22 characters) for a ticket. */
export function makeSeal(ticketId: string, eventId: string): string {
  return mac("seal", ticketId, eventId).subarray(0, SEAL_BYTES).toString("base64url");
}

/** The text that goes inside the QR code. */
export function buildOfflineQr(ticketId: string, eventId: string): string {
  return `OFF.${ticketId}.${makeSeal(ticketId, eventId)}`;
}

/** Splits a scanned text into its ticket id and seal, or null if it is not an offline QR. */
export function parseOfflineQr(text: unknown): { ticketId: string; seal: string } | null {
  if (typeof text !== "string") return null;
  const m = text.trim().match(QR_RE);
  return m ? { ticketId: m[1], seal: m[2] } : null;
}

/** True only if the seal was made by this server for exactly this ticket and event. */
export function verifySeal(ticketId: string, eventId: string, seal: string): boolean {
  return safeEqual(makeSeal(ticketId, eventId), seal);
}

/** The short check code printed beside the serial (e.g. "K3F9X"). */
export function makeCheckCode(ticketId: string, eventId: string): string {
  const bytes = mac("check", ticketId, eventId);
  let code = "";
  for (let i = 0; i < CHECK_LENGTH; i++) code += CHECK_ALPHABET[bytes[i] % CHECK_ALPHABET.length];
  return code;
}

export function normalizeCheckCode(input: unknown): string {
  return String(input ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function verifyCheckCode(ticketId: string, eventId: string, code: unknown): boolean {
  return safeEqual(makeCheckCode(ticketId, eventId), normalizeCheckCode(code));
}
