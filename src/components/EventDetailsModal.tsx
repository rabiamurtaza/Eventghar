"use client";

import { useEffect, useState, useMemo } from "react";
import Image from "next/image";

interface EventDetailsModalProps {
  event: any | null;
  onClose: () => void;
  onBook: (event: any) => void;
}

// Convert uppercase strings like "MUBALI ISLAND TRIP" to sentence/title case: "Mubali Island trip"
function toNormalTitleCase(str: string): string {
  if (!str) return "";
  const cleaned = str.trim().toLowerCase();
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

// Format 24h time like "08:22" or "19:45" to 12-hour format: "8:22 AM"
function format12HourTime(timeStr?: string): string {
  if (!timeStr) return "8:22 AM";
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
  if (!dateStr) return "Wednesday, 28 October 2026";
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
  if (!event) return "Rs. 1,500";
  
  // Check ticket_types relation
  if (Array.isArray(event.ticket_types) && event.ticket_types.length > 0) {
    const valid = event.ticket_types
      .map((t: any) => Number(t.price))
      .filter((p: number) => !isNaN(p));
    if (valid.length > 0) {
      const min = Math.min(...valid);
      return min === 0 ? "Free" : `Rs. ${min.toLocaleString()}`;
    }
  }

  // Check ticket_price JSON string
  if (event.ticket_price) {
    try {
      const parsed = typeof event.ticket_price === "string" 
        ? JSON.parse(event.ticket_price) 
        : event.ticket_price;
      if (Array.isArray(parsed) && parsed.length > 0) {
        const valid = parsed
          .map((t: any) => Number(t.price))
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
  return "Rs. 1,500";
}

export default function EventDetailsModal({
  event,
  onClose,
  onBook,
}: EventDetailsModalProps) {
  const [tripDetailsOpen, setTripDetailsOpen] = useState(false);

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

  // Real data extractions
  const titleFormatted = toNormalTitleCase(event.title || "Mubali Island trip");
  const categoryName = event.category || "Trips";
  const cityName = event.city || "Rawalpindi";
  const dateFormatted = formatFullDate(event.start_date);
  const timeFormatted = format12HourTime(event.start_time || event.doors_open_time);
  const venueName = event.venue_name || event.full_address || "Bahria University";
  const mapsUrl = event.google_maps_link || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venueName + " " + cityName)}`;
  const priceDisplay = getLowestPriceDisplay(event);

  // Extract tagline from first line of description
  const descriptionRaw = (event.description || "").trim();
  const descriptionLines = descriptionRaw ? descriptionRaw.split("\n") : [];
  const tagline = descriptionLines.length > 0 && descriptionLines[0].trim().length > 0
    ? descriptionLines[0].trim()
    : "One day away from deadlines. Good people, good views.";

  // Dynamic or smart fallbacks for trip details
  const isTrip = categoryName.toLowerCase().includes("trip") || categoryName.toLowerCase().includes("tour");

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="event-modal-title"
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 md:p-6"
    >
      {/* Dimmed Blurred Backdrop */}
      <div
        className="fixed inset-0 bg-[#0f071a]/70 backdrop-blur-sm transition-opacity motion-reduce:transition-none"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Main Card Modal / Mobile Bottom Sheet */}
      <div className="relative w-full sm:max-w-[460px] bg-white dark:bg-[#140d24] rounded-t-[24px] sm:rounded-[24px] border border-[#ebdcfb]/80 dark:border-[#352453] shadow-2xl flex flex-col overflow-hidden font-schibsted animate-in fade-in zoom-in-95 max-sm:slide-in-from-bottom duration-200 motion-reduce:transition-none max-h-[92vh] sm:max-h-[88vh]">
        
        {/* Mobile Drag Indicator Handle */}
        <div className="sm:hidden pt-2.5 pb-1 flex justify-center bg-neutral-900">
          <div className="w-10 h-1 bg-white/40 rounded-full" />
        </div>

        {/* Scrollable Container inside Card */}
        <div className="overflow-y-auto overscroll-contain flex-1">
          {/* Top Event Photo Area (224px) */}
          <div className="relative h-[224px] w-full bg-neutral-900 overflow-hidden shrink-0">
            {event.image_url ? (
              <img
                src={event.image_url}
                alt={event.title || "Event photo"}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-[#23153c] text-white/50 text-sm">
                Event photo
              </div>
            )}

            {/* Dark Fade Gradient at the Bottom */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent pointer-events-none" />

            {/* Frosted Glass Tags on Top Photo */}
            <div className="absolute bottom-3.5 left-4 flex items-center gap-2 z-10">
              {/* Category Tag */}
              <span className="backdrop-blur-md bg-white/20 dark:bg-black/40 border border-white/25 text-white text-xs font-semibold px-3 py-1 rounded-full shadow-xs">
                {categoryName}
              </span>

              {/* City Tag with Pin Icon */}
              <span className="backdrop-blur-md bg-white/20 dark:bg-black/40 border border-white/25 text-white text-xs font-semibold px-3 py-1 rounded-full shadow-xs flex items-center gap-1.5">
                <svg
                  className="w-3.5 h-3.5 text-white shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                <span>{cityName}</span>
              </span>
            </div>

            {/* Round Close Button at Top Right */}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close card"
              className="absolute top-3.5 right-3.5 z-20 h-9 w-9 rounded-full bg-black/40 hover:bg-black/70 backdrop-blur-md text-white border border-white/20 flex items-center justify-center transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7a1fd1] shadow-xs cursor-pointer active:scale-95"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Card Body Content */}
          <div className="p-5 sm:p-6 space-y-5">
            {/* Title & Tagline */}
            <div>
              <h2
                id="event-modal-title"
                className="text-2xl font-bold text-[#1f1633] dark:text-[#f6effd] tracking-tight leading-snug"
              >
                {titleFormatted}
              </h2>
              <p className="text-sm text-[#6e6284] dark:text-[#a49ab9] line-clamp-1 mt-1 font-normal">
                {tagline}
              </p>
            </div>

            {/* Three Main Details Rows */}
            <div className="space-y-3.5">
              {/* Row 1: Date written out in full */}
              <div className="flex items-center gap-3.5">
                <div className="h-[46px] w-[46px] rounded-2xl bg-[#f6effd] dark:bg-[#23153c] text-[#6a17b8] dark:text-[#c084fc] flex items-center justify-center shrink-0 border border-[#ebdcfb] dark:border-[#352453] shadow-2xs">
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <span className="block text-xs text-[#6e6284] dark:text-[#a49ab9] font-medium">
                    Date
                  </span>
                  <span className="text-sm font-semibold text-[#1f1633] dark:text-[#f6effd] truncate block">
                    {dateFormatted}
                  </span>
                </div>
              </div>

              {/* Row 2: Departure Time in 12-hour format */}
              <div className="flex items-center gap-3.5">
                <div className="h-[46px] w-[46px] rounded-2xl bg-[#f6effd] dark:bg-[#23153c] text-[#6a17b8] dark:text-[#c084fc] flex items-center justify-center shrink-0 border border-[#ebdcfb] dark:border-[#352453] shadow-2xs">
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <span className="block text-xs text-[#6e6284] dark:text-[#a49ab9] font-medium">
                    {isTrip ? "Departure time" : "Event time"}
                  </span>
                  <span className="text-sm font-semibold text-[#1f1633] dark:text-[#f6effd] truncate block">
                    {timeFormatted}
                  </span>
                </div>
              </div>

              {/* Row 3: Meeting point / venue with small outlined Maps button */}
              <div className="flex items-center gap-3.5">
                <div className="h-[46px] w-[46px] rounded-2xl bg-[#f6effd] dark:bg-[#23153c] text-[#6a17b8] dark:text-[#c084fc] flex items-center justify-center shrink-0 border border-[#ebdcfb] dark:border-[#352453] shadow-2xs">
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <span className="block text-xs text-[#6e6284] dark:text-[#a49ab9] font-medium">
                    {isTrip ? "Meeting point" : "Venue"}
                  </span>
                  <span className="text-sm font-semibold text-[#1f1633] dark:text-[#f6effd] truncate block">
                    {venueName}
                  </span>
                </div>
                {/* Outlined Maps Button */}
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-xs font-semibold text-[#6a17b8] dark:text-[#c084fc] border border-[#d8bbf8] dark:border-[#4d3275] rounded-xl px-2.5 py-1.5 hover:bg-[#f6effd] dark:hover:bg-[#2b1945] transition flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7a1fd1] shadow-2xs"
                >
                  <span>Maps</span>
                  <svg
                    className="w-3 h-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
                  </svg>
                </a>
              </div>
            </div>

            {/* Trip Details Dropdown Row */}
            <div className="pt-2 border-t border-[#ebdcfb]/80 dark:border-[#352453]">
              <button
                type="button"
                onClick={() => setTripDetailsOpen((prev) => !prev)}
                aria-expanded={tripDetailsOpen}
                className="w-full flex items-center justify-between py-2 text-left transition rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7a1fd1] cursor-pointer"
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold text-[#1f1633] dark:text-[#f6effd]">
                    {isTrip ? "Trip details" : "Event details"}
                  </span>
                  <span className="text-xs text-[#6e6284] dark:text-[#a49ab9] font-normal">
                    (Included, what to bring, rules)
                  </span>
                </div>

                {/* Rotating Round Chevron */}
                <div className="h-8 w-8 rounded-full bg-[#f6effd] dark:bg-[#23153c] text-[#6a17b8] dark:text-[#c084fc] border border-[#ebdcfb] dark:border-[#352453] flex items-center justify-center shrink-0 transition-transform duration-300 motion-reduce:transition-none">
                  <svg
                    className={`w-4 h-4 transition-transform duration-300 motion-reduce:transition-none ${
                      tripDetailsOpen ? "rotate-180" : ""
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </div>
              </button>

              {/* Expandable Soft Lavender Panel */}
              {tripDetailsOpen && (
                <div className="mt-2.5 rounded-2xl bg-[#f6effd]/85 dark:bg-[#1f1333] border border-[#ebdcfb] dark:border-[#3a2559] p-4 space-y-4 animate-in fade-in duration-200">
                  {/* 1. What's included */}
                  <div>
                    <h4 className="text-xs font-bold text-[#1f1633] dark:text-[#f6effd] mb-2">
                      What&apos;s included
                    </h4>
                    <div className="space-y-1.5">
                      {[
                        "Round-trip transport",
                        "Meals and snacks",
                        "Trip coordinator",
                      ].map((item, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-2 text-xs text-[#1f1633] dark:text-[#ede4f8]"
                        >
                          <span className="h-4 w-4 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 text-[10px] font-bold">
                            ✓
                          </span>
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 2. What to bring */}
                  <div>
                    <h4 className="text-xs font-bold text-[#1f1633] dark:text-[#f6effd] mb-2">
                      What to bring
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        "Student ID or CNIC",
                        "Water",
                        "Comfortable shoes",
                        "Power bank and cash",
                      ].map((item, idx) => (
                        <span
                          key={idx}
                          className="inline-block bg-white dark:bg-[#2b1b46] border border-[#ebdcfb] dark:border-[#462d6c] text-[#1f1633] dark:text-[#ede4f8] text-[11px] font-medium px-2.5 py-1 rounded-full shadow-2xs"
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* 3. Ground rules */}
                  <div>
                    <h4 className="text-xs font-bold text-[#1f1633] dark:text-[#f6effd] mb-2">
                      Ground rules
                    </h4>
                    <div className="space-y-1.5">
                      {[
                        "Be on time",
                        "Stay with the group",
                        "No littering",
                      ].map((rule, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-2 text-xs text-[#1f1633] dark:text-[#ede4f8]"
                        >
                          <span className="h-4 w-4 rounded-full bg-[#ebdcfb] dark:bg-[#352453] text-[#6a17b8] dark:text-[#c084fc] flex items-center justify-center shrink-0 text-[9px] font-black">
                            •
                          </span>
                          <span>{rule}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Always Visible Footer Bar */}
        <div className="sticky bottom-0 bg-white/95 dark:bg-[#140d24]/95 backdrop-blur-md border-t border-neutral-200/80 dark:border-neutral-800/80 px-5 py-3.5 flex items-center justify-between rounded-b-none sm:rounded-b-[24px] shrink-0">
          <div>
            <span className="block text-xs text-[#6e6284] dark:text-[#a49ab9] font-medium">
              Tickets from
            </span>
            <span className="text-lg font-bold text-[#1f1633] dark:text-[#f6effd]">
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
