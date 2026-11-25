"use client";

type EventOption = { id: string; title?: string | null; event_number?: number | string | null };

/**
 * The ONE event dropdown of a management page. Whatever is chosen here changes everything on
 * the page (bookings, the tickets dashboard, gate attendance, offline tickets, Sync Tickets).
 * "All events" shows everything together.
 */
export default function EventScopeSelect({
  value,
  onChange,
  events,
}: {
  value: string;
  onChange: (id: string) => void;
  events: EventOption[];
}) {
  return (
    <label className="mb-5 flex w-full flex-col gap-1 sm:max-w-md">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Event</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Choose an event"
        className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm font-semibold text-neutral-900 shadow-sm outline-none focus:border-indigo-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
      >
        <option value="All">All events</option>
        {events.map((e, i) => (
          <option key={e.id || i} value={e.id}>
            {e.event_number ? `#${e.event_number} - ` : ""}
            {e.title || "Untitled Event"}
          </option>
        ))}
      </select>
    </label>
  );
}
