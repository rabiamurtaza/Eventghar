"use client";

import { useEffect, useState, useMemo } from "react";

interface EventDetailsModalProps {
  event: any | null;
  onClose: () => void;
  onBook: (event: any) => void;
}

// Convert uppercase strings like "MUBALI ISLAND TRIP" to normal title case: "Mubali Island Trip"
function toTitleCase(str?: string): string {
  if (!str) return "";
  return str
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// Format 24h time like "08:22" or "19:45" to 12-hour format: "8:22 AM"
function format12HourTime(timeStr?: string): string {
  if (!timeStr) return "";
  const parts = timeStr.split(":");
  if (parts.length >= 2) {
    const hours = parseInt(parts[0], 10);
    const minutes = parts[1];
    if (!isNaN(hours)) {
      const ampm = hours >= 12 ? "PM" : "AM";
      const h12 = hours % 12 || 12;
      return `${h12}:${minutes} ${ampm}`;
    }
  }
  return timeStr;
}

// Format ISO date like "2026-10-28" to full written date: "Wednesday, 28 October 2026"
function formatFullDate(dateStr?: string): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr + "T00:00:00");
    if (!isNaN(d.getTime())) {
      return new Intl.DateTimeFormat("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(d);
    }
  } catch (e) {
    // Fallback if parsing fails
  }
  return dateStr;
}

// Compute lowest price formatted as "Rs. 1,500" or "Free"
function getLowestPriceDisplay(event: any): string {
  if (!event) return "Free";

  // 1. Check ticket_types relation
  if (Array.isArray(event.ticket_types) && event.ticket_types.length > 0) {
    const valid = event.ticket_types
      .map((t: any) => Number(t.price))
      .filter((p: number) => !isNaN(p));
    if (valid.length > 0) {
      const min = Math.min(...valid);
      return min === 0 ? "Free" : `Rs. ${min.toLocaleString()}`;
    }
  }

  // 2. Check ticket_price JSON string or array
  if (event.ticket_price) {
    try {
      const parsed = typeof event.ticket_price === "string" 
        ? JSON.parse(event.ticket_price) 
        : event.ticket_price;
      if (Array.isArray(parsed) && parsed.length > 0) {
        const valid = parsed
          .map((t: any) => parseInt(t.price, 10))
          .filter((p: number) => !isNaN(p));
        if (valid.length > 0) {
          const min = Math.min(...valid);
          return min === 0 ? "Free" : `Rs. ${min.toLocaleString()}`;
        }
      }
    } catch (e) {}
  }

  const num = Number(event.price);
  if (!isNaN(num) && num > 0) return `Rs. ${num.toLocaleString()}`;
  return "Free";
}

interface DetailSection {
  heading: string;
  items: string[];
  isList: boolean;
  plainText?: string;
}

interface ParsedDescription {
  intro: string;
  sections: DetailSection[];
  plainParagraphs: string[];
  headingsSummary: string;
  hasExtraDetails: boolean;
}

// Dynamically parse event.description into intro and structured sections
function parseDescription(description?: string): ParsedDescription {
  if (!description || !description.trim()) {
    return {
      intro: "",
      sections: [],
      plainParagraphs: [],
      headingsSummary: "",
      hasExtraDetails: false,
    };
  }

  const lines = description
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return {
      intro: "",
      sections: [],
      plainParagraphs: [],
      headingsSummary: "",
      hasExtraDetails: false,
    };
  }

  // Line 1 is the short intro line
  const intro = lines[0];
  const remainingLines = lines.slice(1);

  const sections: DetailSection[] = [];
  const plainParagraphs: string[] = [];

  // Match pattern: "Heading: item1, item2, item3" or "Heading: single sentence"
  const headingRegex = /^([A-Za-z0-9\s&'/_-]+):\s*(.*)$/;

  for (const line of remainingLines) {
    const match = line.match(headingRegex);
    if (match) {
      const heading = match[1].trim();
      const content = match[2].trim();
      if (content.includes(",")) {
        const items = content
          .split(",")
          .map((i) => i.trim().replace(/^\[|\]$/g, "")) // clean accidental brackets
          .filter((i) => i.length > 0);
        sections.push({
          heading,
          items,
          isList: true,
        });
      } else {
        sections.push({
          heading,
          items: content ? [content] : [],
          isList: false,
          plainText: content,
        });
      }
    } else {
      plainParagraphs.push(line);
    }
  }

  const headingsSummary = sections.map((s) => s.heading).join(", ");
  const hasExtraDetails = sections.length > 0 || plainParagraphs.length > 0;

  return {
    intro,
    sections,
    plainParagraphs,
    headingsSummary,
    hasExtraDetails,
  };
}

export default function EventDetailsModal({
  event,
  onClose,
  onBook,
}: EventDetailsModalProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Keyboard navigation: Escape key closes modal
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Lock body scroll when modal is active
  useEffect(() => {
    if (event) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [event]);

  if (!event) return null;

  // Real data binding
  const title = toTitleCase(event.title || "Untitled Event");
  const category = event.category || "Event";
  const city = event.city || "";
  const formattedDate = formatFullDate(event.start_date);
  const formattedTime = format12HourTime(event.start_time);
  const formattedDoors = format12HourTime(event.doors_open_time);
  const venue = event.venue_name || event.full_address || "";
  const mapsUrl = event.google_maps_link || (venue ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venue + " " + city)}` : "");
  const priceDisplay = getLowestPriceDisplay(event);

  const { intro, sections, plainParagraphs, headingsSummary, hasExtraDetails } = parseDescription(event.description);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="event-details-modal-title"
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 md:p-6"
    >
      {/* Dimmed Blurred Backdrop */}
      <div
        className="fixed inset-0 bg-[#0f071a]/70 backdrop-blur-sm transition-opacity motion-reduce:transition-none"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Main Card (460px Desktop Modal / Mobile Bottom Sheet) */}
      <div className="relative w-full sm:max-w-[460px] bg-white dark:bg-[#140d24] rounded-t-[24px] sm:rounded-[24px] border border-neutral-200/90 dark:border-[#352453] shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 max-sm:slide-in-from-bottom duration-200 motion-reduce:transition-none max-h-[92vh] sm:max-h-[88vh]">
        
        {/* Mobile Drag Indicator Handle */}
        <div className="sm:hidden pt-2.5 pb-1 flex justify-center bg-neutral-900/90">
          <div className="w-10 h-1 bg-white/40 rounded-full" />
        </div>

        {/* Scrollable Container inside Card */}
        <div className="overflow-y-auto overscroll-contain flex-1">
          {/* Top Event Image with Close Button */}
          <div className="relative h-[224px] w-full bg-neutral-900 overflow-hidden shrink-0">
            {event.image_url ? (
              <img
                src={event.image_url}
                alt={event.title || "Event photo"}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-[#23153c] text-white/50 text-sm">
                Event image
              </div>
            )}

            {/* Dark bottom gradient fade for smooth text legibility */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent pointer-events-none" />

            {/* Round Close Button at Top Right */}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close details"
              className="absolute top-3.5 right-3.5 z-20 h-9 w-9 rounded-full bg-black/40 hover:bg-black/70 backdrop-blur-md text-white border border-white/20 flex items-center justify-center transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7a1fd1] shadow-xs cursor-pointer active:scale-95"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Card Body Content */}
          <div className="p-5 sm:p-6 space-y-4">
            {/* Header: Category & City info */}
            <div>
              <p className="text-xs font-semibold text-[#6a17b8] dark:text-[#c084fc] mb-1">
                {category}{city ? ` • ${city}` : ""}
              </p>
              <h2
                id="event-details-modal-title"
                className="text-2xl font-extrabold text-[#1c1230] dark:text-white tracking-tight leading-snug font-heading"
              >
                {title}
              </h2>
              {intro && (
                <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1 font-normal line-clamp-2">
                  {intro}
                </p>
              )}
            </div>

            {/* Student Only Note if enabled */}
            {event.is_student_only && (
              <div className="rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/40 p-2.5 text-xs text-blue-800 dark:text-blue-300 font-medium">
                Student Only Event {event?.university_name && `- ${event.university_name}`}
              </div>
            )}

            {/* Detail Rows with 46px Lavender Icon Tiles */}
            <div className="space-y-3 pt-1">
              {/* Row 1: Date */}
              {formattedDate && (
                <div className="flex items-center gap-3">
                  <div className="h-[46px] w-[46px] rounded-2xl bg-[#f6effd] dark:bg-[#23153c] text-[#6a17b8] dark:text-[#c084fc] flex items-center justify-center shrink-0 border border-[#ebdcfb] dark:border-[#352453] shadow-2xs">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="block text-xs text-neutral-500 dark:text-neutral-400 font-medium">
                      Date
                    </span>
                    <span className="text-sm font-semibold text-[#1c1230] dark:text-white truncate block">
                      {formattedDate}
                    </span>
                  </div>
                </div>
              )}

              {/* Row 2: Time */}
              {formattedTime && (
                <div className="flex items-center gap-3">
                  <div className="h-[46px] w-[46px] rounded-2xl bg-[#f6effd] dark:bg-[#23153c] text-[#6a17b8] dark:text-[#c084fc] flex items-center justify-center shrink-0 border border-[#ebdcfb] dark:border-[#352453] shadow-2xs">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="block text-xs text-neutral-500 dark:text-neutral-400 font-medium">
                      Time
                    </span>
                    <span className="text-sm font-semibold text-[#1c1230] dark:text-white truncate block">
                      {formattedTime}
                    </span>
                  </div>
                </div>
              )}

              {/* Row 3: Doors Open (only if present) */}
              {formattedDoors && (
                <div className="flex items-center gap-3">
                  <div className="h-[46px] w-[46px] rounded-2xl bg-[#f6effd] dark:bg-[#23153c] text-[#6a17b8] dark:text-[#c084fc] flex items-center justify-center shrink-0 border border-[#ebdcfb] dark:border-[#352453] shadow-2xs">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="block text-xs text-neutral-500 dark:text-neutral-400 font-medium">
                      Doors open
                    </span>
                    <span className="text-sm font-semibold text-[#1c1230] dark:text-white truncate block">
                      {formattedDoors}
                    </span>
                  </div>
                </div>
              )}

              {/* Row 4: Venue */}
              {venue && (
                <div className="flex items-center gap-3">
                  <div className="h-[46px] w-[46px] rounded-2xl bg-[#f6effd] dark:bg-[#23153c] text-[#6a17b8] dark:text-[#c084fc] flex items-center justify-center shrink-0 border border-[#ebdcfb] dark:border-[#352453] shadow-2xs">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="block text-xs text-neutral-500 dark:text-neutral-400 font-medium">
                      Venue
                    </span>
                    <span className="text-sm font-semibold text-[#1c1230] dark:text-white truncate block">
                      {venue}
                    </span>
                  </div>
                  {mapsUrl && (
                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 text-xs font-semibold text-[#6a17b8] dark:text-[#c084fc] border border-[#d8bbf8] dark:border-[#4d3275] rounded-xl px-2.5 py-1.5 hover:bg-[#f6effd] dark:hover:bg-[#2b1945] transition flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7a1fd1] shadow-2xs"
                    >
                      <span>Maps</span>
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  )}
                </div>
              )}
            </div>

            {/* Dynamic Dropdown for Extra Details (Shown only when extra details exist) */}
            {hasExtraDetails && (
              <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={() => setDetailsOpen((prev) => !prev)}
                  aria-expanded={detailsOpen}
                  className="w-full flex items-center justify-between py-2 text-left transition rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7a1fd1] cursor-pointer"
                >
                  <div className="min-w-0 pr-2">
                    <span className="text-sm font-bold text-[#1c1230] dark:text-white block">
                      More details
                    </span>
                    {headingsSummary && (
                      <span className="text-xs text-neutral-500 dark:text-neutral-400 font-normal block truncate">
                        {headingsSummary}
                      </span>
                    )}
                  </div>

                  {/* Rotating Chevron Icon */}
                  <div className="h-8 w-8 rounded-full bg-[#f6effd] dark:bg-[#23153c] text-[#6a17b8] dark:text-[#c084fc] border border-[#ebdcfb] dark:border-[#352453] flex items-center justify-center shrink-0 transition-transform duration-300 motion-reduce:transition-none">
                    <svg
                      className={`w-4 h-4 transition-transform duration-300 motion-reduce:transition-none ${
                        detailsOpen ? "rotate-180" : ""
                      }`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2.5}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {/* Soft Lavender Accordion Panel */}
                {detailsOpen && (
                  <div className="mt-2.5 rounded-2xl bg-[#f6effd]/90 dark:bg-[#1f1333] border border-[#ebdcfb] dark:border-[#3a2559] p-4 space-y-3.5 animate-in fade-in duration-200">
                    {/* Render Structured Sections */}
                    {sections.map((sec, idx) => (
                      <div key={idx}>
                        <h4 className="text-xs font-bold text-[#1c1230] dark:text-white mb-1.5 capitalize">
                          {sec.heading}
                        </h4>

                        {sec.isList ? (
                          // Checklist or Pill chips based on heading type
                          sec.heading.toLowerCase().includes("bring") ? (
                            <div className="flex flex-wrap gap-1.5">
                              {sec.items.map((item, iIdx) => (
                                <span
                                  key={iIdx}
                                  className="inline-block bg-white dark:bg-[#2b1b46] border border-[#ebdcfb] dark:border-[#462d6c] text-[#1c1230] dark:text-[#ede4f8] text-[11px] font-medium px-2.5 py-1 rounded-full shadow-2xs"
                                >
                                  {item}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <div className="space-y-1.5">
                              {sec.items.map((item, iIdx) => (
                                <div key={iIdx} className="flex items-center gap-2 text-xs text-[#1c1230] dark:text-[#ede4f8]">
                                  <span className="h-4 w-4 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 text-[10px] font-bold">
                                    ✓
                                  </span>
                                  <span>{item}</span>
                                </div>
                              ))}
                            </div>
                          )
                        ) : (
                          // Plain sentence under heading
                          <p className="text-xs text-[#1c1230] dark:text-[#ede4f8] leading-relaxed">
                            {sec.plainText || sec.items[0]}
                          </p>
                        )}
                      </div>
                    ))}

                    {/* Plain Paragraphs if description had lines without heading */}
                    {plainParagraphs.length > 0 && (
                      <div className="space-y-2 pt-1">
                        {plainParagraphs.map((para, pIdx) => (
                          <p key={pIdx} className="text-xs text-[#1c1230] dark:text-[#ede4f8] leading-relaxed">
                            {para}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Always Visible Sticky Footer Bar */}
        <div className="sticky bottom-0 bg-white/95 dark:bg-[#140d24]/95 backdrop-blur-md border-t border-neutral-200/90 dark:border-neutral-800 px-5 py-3.5 flex items-center justify-between rounded-b-none sm:rounded-b-[24px] shrink-0">
          <div>
            <span className="block text-xs text-neutral-500 dark:text-neutral-400 font-medium">
              Tickets from
            </span>
            <span className="text-lg font-bold text-[#1c1230] dark:text-white">
              {priceDisplay}
            </span>
          </div>

          <button
            type="button"
            onClick={() => onBook(event)}
            className="rounded-xl bg-[#7a1fd1] hover:bg-[#6114ae] text-white font-bold text-sm px-6 py-3 transition shadow-lg shadow-[#7a1fd1]/25 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7a1fd1] focus-visible:ring-offset-2 cursor-pointer"
          >
            Book tickets
          </button>
        </div>
      </div>
    </div>
  );
}
