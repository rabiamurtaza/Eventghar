"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  keyword: string;
  onKeyword: (v: string) => void;
  city: string;
  onCity: (v: string) => void;
  category: string;
  onCategory: (v: string) => void;
  cities: string[];
  categories: string[];
};

/**
 * One search button for the events list. It opens a small panel with the search box and the
 * City and Category choices, so the page itself stays short. Filtering works exactly as before;
 * this only changes where the controls live.
 */
export default function EventSearchButton({ keyword, onKeyword, city, onCity, category, onCategory, cities, categories }: Props) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const activeCount = (keyword.trim() ? 1 : 0) + (city !== "All" ? 1 : 0) + (category !== "All" ? 1 : 0);

  // Close on outside click or Escape
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    document.addEventListener("keydown", onKey);
    inputRef.current?.focus();
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const clearAll = () => {
    onKeyword("");
    onCity("All");
    onCategory("All");
  };

  const field =
    "w-full h-11 rounded-xl border border-neutral-300 bg-neutral-50 px-3.5 text-sm text-[#1c1230] outline-none focus:border-[#7a1fd1] focus:ring-1 focus:ring-[#7a1fd1] transition";

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="Search events"
        className="relative inline-flex h-11 sm:h-12 items-center gap-2 rounded-full border border-neutral-300 bg-white px-4 sm:px-5 text-sm font-semibold text-[#1c1230] shadow-sm transition hover:border-[#7a1fd1] hover:text-[#6a17b8] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7a1fd1]"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <span className="hidden sm:inline">Search</span>
        {activeCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#7a1fd1] px-1 text-[11px] font-bold text-white">
            {activeCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Search events"
          className="absolute right-0 z-30 mt-2 w-[min(92vw,22rem)] rounded-2xl border border-neutral-200 bg-white p-4 shadow-xl"
        >
          <label className="mb-3 block">
            <span className="mb-1 block text-xs font-semibold text-[#1c1230]">Search</span>
            <input
              ref={inputRef}
              type="text"
              placeholder="Search events or venues..."
              value={keyword}
              onChange={(e) => onKeyword(e.target.value)}
              className={`${field} placeholder:text-neutral-400`}
            />
          </label>
          <div className="mb-4 grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-[#1c1230]">City</span>
              <select value={city} onChange={(e) => onCity(e.target.value)} className={field}>
                {cities.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-[#1c1230]">Category</span>
              <select value={category} onChange={(e) => onCategory(e.target.value)} className={field}>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={clearAll}
              disabled={activeCount === 0}
              className="text-sm font-semibold text-neutral-500 transition hover:text-[#6a17b8] disabled:opacity-40"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full bg-[#7a1fd1] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#6a17b8]"
            >
              Show events
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
