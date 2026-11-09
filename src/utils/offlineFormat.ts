import type { EventInfo } from "@/utils/offlineTypes";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "2026-11-20" -> "20 November 2026" */
export function formatEventDate(value?: string | null): string {
  if (!value) return "";
  const dateOnly = value.includes("T") ? value.split("T")[0] : value.split(" ")[0];
  const [y, m, d] = dateOnly.split("-");
  const month = MONTHS[parseInt(m, 10) - 1];
  const day = parseInt(d, 10);
  return month && !isNaN(day) ? `${day} ${month} ${y}` : value;
}

/** "20:30:00" -> "8:30 PM" */
export function formatEventTime(value?: string | null): string {
  if (!value) return "";
  const [h, min] = value.split(":");
  const hours = parseInt(h, 10);
  if (isNaN(hours) || min === undefined) return value;
  return `${hours % 12 || 12}:${min.slice(0, 2)} ${hours >= 12 ? "PM" : "AM"}`;
}

/** "20 November 2026, 8:30 PM" */
export function eventWhen(event?: Pick<EventInfo, "start_date" | "start_time"> | null): string {
  if (!event) return "";
  return [formatEventDate(event.start_date), formatEventTime(event.start_time)].filter(Boolean).join(", ");
}

/** "Arts Council, Karachi" */
export function eventWhere(event?: Pick<EventInfo, "venue_name" | "city"> | null): string {
  if (!event) return "";
  return [event.venue_name, event.city].filter(Boolean).join(", ");
}

/** 1500 -> "Rs. 1,500", 0 -> "Free" */
export function money(amount: number | string | null | undefined): string {
  const n = Number(amount) || 0;
  return n === 0 ? "Free" : `Rs. ${n.toLocaleString("en-US")}`;
}

/** A total of money (never "Free"): 0 -> "Rs. 0", 250000 -> "Rs. 250,000" */
export function moneyTotal(amount: number | string | null | undefined): string {
  return `Rs. ${(Number(amount) || 0).toLocaleString("en-US")}`;
}

/** Date + time in Pakistan time, for batch lists: "20 Nov 2026, 3:05 PM" */
export function formatStamp(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Karachi",
  });
}
