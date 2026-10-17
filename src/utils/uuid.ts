/**
 * RFC 9562 UUID Version 7 Generator and Validator
 *
 * UUIDv7 provides time-ordered, sortable unique identifiers with millisecond
 * precision, optimizing B-tree database index performance and eliminating
 * random fragmentation.
 */

let lastMs = 0;
let seq = 0;

/**
 * Generates an RFC 9562 compliant UUID Version 7 string.
 */
export function uuidv7(): string {
  let now = Date.now();

  // Monotonic sequence handling if called within the same millisecond
  if (now === lastMs) {
    seq = (seq + 1) & 0x0fff;
    if (seq === 0) {
      // Sequence overflow in same millisecond, wait a tick
      now = now + 1;
    }
  } else if (now < lastMs) {
    // Clock moved backwards, anchor to last timestamp
    now = lastMs;
    seq = (seq + 1) & 0x0fff;
  } else {
    lastMs = now;
    seq = Math.floor(Math.random() * 0x100);
  }

  // 1. 48-bit timestamp (ms since Unix epoch)
  const timeHex = now.toString(16).padStart(12, "0");

  // 2. 4-bit version (7) + 12-bit sequence/random
  const verAndSeq = (0x7000 | (seq & 0x0fff)).toString(16).padStart(4, "0");

  // 3. 2-bit variant (10xx) + 14-bit random
  const randA = typeof crypto !== "undefined" && crypto.getRandomValues
    ? crypto.getRandomValues(new Uint16Array(1))[0]
    : Math.floor(Math.random() * 0x10000);
  const varAndRand = (0x8000 | (randA & 0x3fff)).toString(16).padStart(4, "0");

  // 4. 48-bit random bytes
  let randB = "";
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const bytes = new Uint8Array(6);
    crypto.getRandomValues(bytes);
    randB = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  } else {
    for (let i = 0; i < 6; i++) {
      randB += Math.floor(Math.random() * 256).toString(16).padStart(2, "0");
    }
  }

  // Construct 8-4-4-4-12 UUIDv7 format
  const part1 = timeHex.slice(0, 8);
  const part2 = timeHex.slice(8, 12);
  const part3 = verAndSeq;
  const part4 = varAndRand;
  const part5 = randB;

  return `${part1}-${part2}-${part3}-${part4}-${part5}`.toLowerCase();
}

/**
 * Extracts the millisecond timestamp from an RFC 9562 UUIDv7 string.
 */
export function getUUIDv7Timestamp(uuid: string): Date | null {
  if (!isUUIDv7(uuid)) return null;
  const clean = uuid.replace(/-/g, "");
  const timeHex = clean.slice(0, 12);
  const ms = parseInt(timeHex, 16);
  return isNaN(ms) ? null : new Date(ms);
}

/**
 * Validates whether a given string is a valid UUIDv7.
 */
export function isUUIDv7(uuid: string): boolean {
  if (typeof uuid !== "string") return false;
  const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return regex.test(uuid);
}
