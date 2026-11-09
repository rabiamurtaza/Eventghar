"use client";

export type BookingKind = "online" | "offline";

/**
 * The sliding switch at the top of Manage Bookings:  Online bookings | Offline bookings.
 * Online = everything the page has always shown. Offline = printed cash tickets.
 */
export default function BookingKindSwitch({
  value,
  onChange,
}: {
  value: BookingKind;
  onChange: (next: BookingKind) => void;
}) {
  const base = "relative z-10 whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold transition-colors duration-300 sm:px-6";
  const on = "text-neutral-900 dark:text-white";
  const off = "text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200";

  return (
    <div
      role="tablist"
      aria-label="Booking type"
      className="relative mb-6 inline-grid grid-cols-2 rounded-full bg-neutral-200/80 p-1 dark:bg-neutral-800"
    >
      {/* the sliding highlight */}
      <span
        aria-hidden="true"
        className={`absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-full bg-white shadow-sm transition-transform duration-300 ease-out dark:bg-neutral-950 ${
          value === "offline" ? "translate-x-full" : ""
        }`}
      />
      <button
        type="button"
        role="tab"
        aria-selected={value === "online"}
        onClick={() => onChange("online")}
        className={`${base} ${value === "online" ? on : off}`}
      >
        🌐 Online bookings
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={value === "offline"}
        onClick={() => onChange("offline")}
        className={`${base} ${value === "offline" ? on : off}`}
      >
        🖨️ Offline bookings
      </button>
    </div>
  );
}
