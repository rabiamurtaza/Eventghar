"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import EventDetailsModal from "@/components/EventDetailsModal";

const CITIES = ["All", "Karachi", "Lahore", "Islamabad", "Rawalpindi", "Faisalabad"];
const CATEGORIES = ["All", "Trips", "Qawwali Nights", "Concert", "Music", "Technology", "Food", "Business", "Arts", "Sports", "University Fest", "Workshop"];

function toTitleCase(str?: string): string {
  if (!str) return "";
  return str
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export default function EventsSection() {
  const router = useRouter();
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [city, setCity] = useState("All");
  const [category, setCategory] = useState("All");
  const [keyword, setKeyword] = useState("");
  
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);

  // Fetch real events from Supabase
  useEffect(() => {
    async function fetchEvents() {
      const supabase = createClient();
      const { data } = await supabase
        .from('events')
        .select('*, ticket_types(*)')
        .eq('status', 'published')
        .order('created_at', { ascending: false });

      if (data) {
        setEvents(data);
      }
      setLoading(false);
    }
    fetchEvents();
  }, []);

  // Filter logic
  const displayPrice = (item: any) => {
    if (!item) return "Free";
    if (typeof item === 'object' && !Array.isArray(item)) {
      if (item.ticket_price) {
        return displayPrice(item.ticket_price);
      }
      if (Array.isArray(item.ticket_types) && item.ticket_types.length > 0) {
        const validPrices = item.ticket_types.map((t: any) => Number(t.price)).filter((p: number) => !isNaN(p));
        if (validPrices.length > 0) {
          const minPrice = Math.min(...validPrices);
          return minPrice === 0 ? "Free" : `From Rs. ${minPrice.toLocaleString()}`;
        }
      }
      return "Free";
    }
    try {
      const parsed = typeof item === 'string' ? JSON.parse(item) : item;
      if (Array.isArray(parsed) && parsed.length > 0) {
        const validPrices = parsed.map((t: any) => parseInt(t.price, 10)).filter((p: number) => !isNaN(p));
        if (validPrices.length > 0) {
          const minPrice = Math.min(...validPrices);
          return minPrice === 0 ? "Free" : `From Rs. ${minPrice.toLocaleString()}`;
        }
        return parsed[0].price === "Free" || parsed[0].price === "0" ? "Free" : `Rs. ${parsed[0].price}`;
      }
    } catch(e) {}
    const num = Number(item);
    return isNaN(num) ? item : `Rs. ${num.toLocaleString()}`;
  };

  const handleBookTicketClick = async (event: any) => {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    const targetBookUrl = `/book/${event.event_number || event.id}`;
    
    if (!session) {
      const msg = encodeURIComponent("Please create an account or log in first to book your tickets.");
      router.push(`/login?redirect=${encodeURIComponent(targetBookUrl)}&message=${msg}`);
    } else {
      router.push(targetBookUrl);
    }
  };

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      const matchCity = city === "All" || event.city === city;
      const matchCategory = category === "All" || event.category === category;
      const matchKeyword = event.title?.toLowerCase().includes(keyword.toLowerCase()) || event.description?.toLowerCase().includes(keyword.toLowerCase());

      return matchCity && matchCategory && matchKeyword;
    });
  }, [events, city, category, keyword]);

  return (
    <section id="events" className="mt-12 sm:mt-16 scroll-mt-24 pb-16">
      {/* 1. SECTION HEADER */}
      <div className="mb-8 md:mb-10 text-left">
        <h2 className="text-3xl font-extrabold tracking-tight text-[#1c1230] dark:text-white sm:text-4xl font-heading">
          Explore Upcoming Events
        </h2>
        <p className="mt-2 text-base sm:text-lg text-neutral-600 dark:text-neutral-400 font-body">
          Filter by city, category, or search to find exactly what you are looking for.
        </p>
      </div>

      {/* 2. FILTER BAR: One consolidated white rounded bar with taller fields and bigger labels */}
      <div className="mb-10 rounded-2xl sm:rounded-3xl bg-white dark:bg-[#1a102b] p-5 sm:p-6 shadow-sm border border-neutral-200/90 dark:border-[#352453]">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 items-end">
          
          <div>
            <label className="block text-xs sm:text-sm font-semibold text-[#1c1230] dark:text-neutral-200 mb-1.5">
              City
            </label>
            <select 
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full h-12 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 px-3.5 text-sm text-[#1c1230] dark:text-white outline-none focus:border-[#7a1fd1] focus:ring-1 focus:ring-[#7a1fd1] transition"
            >
              {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-semibold text-[#1c1230] dark:text-neutral-200 mb-1.5">
              Category
            </label>
            <select 
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full h-12 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 px-3.5 text-sm text-[#1c1230] dark:text-white outline-none focus:border-[#7a1fd1] focus:ring-1 focus:ring-[#7a1fd1] transition"
            >
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-semibold text-[#1c1230] dark:text-neutral-200 mb-1.5">
              Search
            </label>
            <input 
              type="text" 
              placeholder="Keywords..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="w-full h-12 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 px-3.5 text-sm text-[#1c1230] dark:text-white outline-none focus:border-[#7a1fd1] focus:ring-1 focus:ring-[#7a1fd1] transition placeholder:text-neutral-400"
            />
          </div>

        </div>
      </div>

      {/* 3. EVENT GRID */}
      {loading ? (
        <div className="py-20 text-center text-neutral-500 font-medium">Loading events...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
          {filteredEvents.length > 0 ? (
            filteredEvents.map((event) => (
              <div 
                key={event.id} 
                onClick={() => setSelectedEvent(event)}
                className="group relative overflow-hidden rounded-2xl bg-white dark:bg-[#1a102b] border border-neutral-200/90 dark:border-[#352453] shadow-xs transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-[#7a1fd1]/10 cursor-pointer flex flex-col"
              >
                {/* 16:10 Aspect Ratio Image Area on Top */}
                <div className="aspect-[16/10] w-full bg-neutral-100 dark:bg-neutral-900 flex items-center justify-center relative overflow-hidden">
                  {event.image_url ? (
                    <img 
                      src={event.image_url} 
                      alt={event.title || "Event photo"} 
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
                    />
                  ) : (
                    <span className="text-neutral-400 text-sm font-medium">No Image</span>
                  )}

                  {/* LIVE Badge on Published Events */}
                  {event.status === "published" && (
                    <div className="absolute top-3.5 left-3.5 z-10 rounded-full bg-[#7a1fd1] px-2.5 py-0.5 text-[11px] font-bold text-white shadow-xs">
                      LIVE
                    </div>
                  )}
                </div>
                
                {/* Card Content */}
                <div className="p-5 sm:p-6 flex flex-col flex-1">
                  {/* Date in purple on left, Category on right */}
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs sm:text-sm font-bold text-[#6a17b8] dark:text-[#c084fc] flex items-center gap-1.5">
                      {event.event_number && (
                        <span className="text-xs px-2 py-0.5 rounded-md bg-[#f6effd] dark:bg-[#2b1b46] text-[#6a17b8] dark:text-[#c084fc] font-bold border border-[#ebdcfb] dark:border-[#462d6c]">
                          #{event.event_number}
                        </span>
                      )}
                      <span>{event.start_date || "TBD"}</span>
                    </span>
                    <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                      {event.category || "General"}
                    </span>
                  </div>
                  
                  {/* Title in normal title case */}
                  <h3 className="text-lg sm:text-xl font-bold text-[#1c1230] dark:text-white mb-4 line-clamp-2 font-heading">
                    {toTitleCase(event.title || "Untitled Event")}
                  </h3>
                  
                  {/* Bottom row: City with pin on left, price on right */}
                  <div className="mt-auto flex items-center justify-between pt-3 border-t border-neutral-100 dark:border-neutral-800/80">
                    <div className="flex items-center text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 font-medium">
                      <svg className="mr-1.5 h-4 w-4 text-[#6a17b8] dark:text-[#c084fc] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span>{event.city || "Various"}</span>
                    </div>
                    <div className="text-sm font-bold text-[#1c1230] dark:text-white">
                      {displayPrice(event)}
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full py-12 text-center text-neutral-500">
              No events found matching your filters.
            </div>
          )}
        </div>
      )}

      {/* 4. DYNAMIC EVENT DETAILS MODAL */}
      <EventDetailsModal
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
        onBook={handleBookTicketClick}
      />
    </section>
  );
}
