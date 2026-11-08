"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import EventDetailsModal from "@/components/EventDetailsModal";
import { getEventLifecycle } from "@/utils/eventLifecycle";
import SectionHeader from "@/components/SectionHeader";

import { CITIES as SITE_CITIES, CATEGORIES as SITE_CATEGORIES } from "@/config/site";

const CITIES = ["All", ...SITE_CITIES];
const CATEGORIES = ["All", ...SITE_CATEGORIES];

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
  const [bookingsMap, setBookingsMap] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const [city, setCity] = useState("All");
  const [category, setCategory] = useState("All");
  const [keyword, setKeyword] = useState("");
  
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);

  const supabase = useMemo(() => createClient(), []);

  // Fetch real events and active booking counts from Supabase
  const fetchEvents = useMemo(() => {
    return async () => {
      const [eventsRes, bookingsRes] = await Promise.all([
        supabase
          .from('events')
          .select('*, ticket_types(*)')
          .eq('status', 'published')
          .order('created_at', { ascending: false }),
        supabase
          .from('bookings')
          .select('event_id, number_of_tickets, status')
          .in('status', ['verified', 'confirmed', 'pending'])
      ]);

      if (eventsRes.data) {
        setEvents(eventsRes.data);
      }

      if (bookingsRes.data) {
        const counts: Record<string, number> = {};
        bookingsRes.data.forEach((b: any) => {
          if (b.event_id) {
            counts[b.event_id] = (counts[b.event_id] || 0) + (Number(b.number_of_tickets) || 1);
          }
        });
        setBookingsMap(counts);
      }
      setLoading(false);
    };
  }, [supabase]);

  useEffect(() => {
    fetchEvents();

    // Realtime subscription for live event updates and ticket counts
    const channel = supabase
      .channel("events-homepage-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "events" },
        () => {
          fetchEvents();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bookings" },
        () => {
          fetchEvents();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchEvents, supabase]);

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
        const validPrices = parsed.map((t: any) => parseFloat(String(t.price ?? '').replace(/,/g, ''))).filter((p: number) => !isNaN(p));
        if (validPrices.length > 0) {
          const minPrice = Math.min(...validPrices);
          return minPrice === 0 ? "Free" : `From Rs. ${minPrice.toLocaleString()}`;
        }
        // No numeric price on any tier (blank / "Free") -> treat as free
        return "Free";
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
      router.push(`/login?redirect=${encodeURIComponent(targetBookUrl)}`);
    } else {
      router.push(targetBookUrl);
    }
  };

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      const matchCity = city === "All" || event.city === city;
      const matchCategory = category === "All" || event.category === category;
      const q = keyword.trim().toLowerCase();
      const matchKeyword = !q || [event.title, event.description, event.venue_name].some((v) => (v || "").toLowerCase().includes(q));

      return matchCity && matchCategory && matchKeyword;
    });
  }, [events, city, category, keyword]);


  return (
    <section id="events" className="scroll-mt-24 w-full">
      {/* 1. SECTION HEADER */}
      <SectionHeader
        title="Explore Upcoming Events"
        subtitle="Filter by city, category, or search to find exactly what you are looking for."
      />

      {/* 2. FILTER BAR: One consolidated white rounded bar with taller fields and bigger labels */}
      <div className="mb-8 sm:mb-10 rounded-3xl bg-white p-5 sm:p-6 shadow-sm border border-neutral-200/90">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 sm:gap-6 items-end">
          
          <div>
            <label className="block text-xs sm:text-sm font-semibold text-[#1c1230] mb-1 sm:mb-1.5">
              City
            </label>
            <select 
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full h-11 sm:h-12 rounded-xl border border-neutral-300 bg-neutral-50 px-3.5 text-xs sm:text-sm text-[#1c1230] outline-none focus:border-[#7a1fd1] focus:ring-1 focus:ring-[#7a1fd1] transition"
            >
              {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-semibold text-[#1c1230] mb-1 sm:mb-1.5">
              Category
            </label>
            <select 
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full h-11 sm:h-12 rounded-xl border border-neutral-300 bg-neutral-50 px-3.5 text-xs sm:text-sm text-[#1c1230] outline-none focus:border-[#7a1fd1] focus:ring-1 focus:ring-[#7a1fd1] transition"
            >
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-semibold text-[#1c1230] mb-1 sm:mb-1.5">
              Search
            </label>
            <input 
              type="text" 
              placeholder="Search events or venues..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="w-full h-11 sm:h-12 rounded-xl border border-neutral-300 bg-neutral-50 px-3.5 text-xs sm:text-sm text-[#1c1230] outline-none focus:border-[#7a1fd1] focus:ring-1 focus:ring-[#7a1fd1] transition placeholder:text-neutral-400"
            />
          </div>

        </div>
      </div>

      {/* 3. EVENT GRID */}
      {loading ? (
        <div className="py-20 text-center text-neutral-500 font-medium">Loading events...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-8">
          {filteredEvents.length > 0 ? (
            filteredEvents.map((event) => {
              const bookedCount = bookingsMap[event.id] || 0;
              const lifecycle = getEventLifecycle(event, bookedCount);

              return (
                <div 
                  key={event.id} 
                  onClick={() => setSelectedEvent({ ...event, bookedCount, lifecycle })}
                  className="group relative overflow-hidden rounded-3xl bg-white border border-neutral-200/90 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md hover:shadow-[#7a1fd1]/10 cursor-pointer flex flex-col"
                >
                  {/* 16:10 Aspect Ratio Image Area on Top */}
                  <div className="aspect-[16/10] w-full bg-neutral-100 flex items-center justify-center relative overflow-hidden">
                    {event.image_url ? (
                      <img 
                        src={event.image_url} 
                        alt={event.title || "Event photo"} 
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
                      />
                    ) : (
                      <span className="text-neutral-400 text-sm font-medium">No Image</span>
                    )}

                    {/* Dynamic Lifecycle Badge */}
                    <div className={`absolute top-3.5 left-3.5 z-10 rounded-full ${lifecycle.badgeBg} ${lifecycle.badgeText} px-2.5 py-0.5 text-[11px] font-semibold shadow-xs tracking-wider uppercase`}>
                      {lifecycle.label}
                    </div>
                  </div>
                  
                  {/* Card Content */}
                  <div className="p-5 sm:p-6 flex flex-col flex-1">
                    {/* Date in purple on left, Category on right */}
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs sm:text-sm font-semibold text-[#6a17b8] flex items-center gap-1.5">
                        {event.event_number && (
                          <span className="text-xs px-2 py-0.5 rounded-md bg-[#f6effd] text-[#6a17b8] font-semibold border border-[#ebdcfb]">
                            #{event.event_number}
                          </span>
                        )}
                        <span>{event.start_date || "TBD"}</span>
                      </span>
                      <span className="text-xs font-medium text-neutral-500">
                        {event.category || "General"}
                      </span>
                    </div>
                    
                    {/* Title in normal title case */}
                    <h3 className="text-base sm:text-xl font-semibold text-[#1c1230] mb-3 sm:mb-4 line-clamp-2 font-heading">
                      {toTitleCase(event.title || "Untitled Event")}
                    </h3>
                    
                    {/* Bottom row: City with pin on left, price on right */}
                    <div className="mt-auto flex items-center justify-between pt-3 border-t border-neutral-100">
                      <div className="flex min-w-0 items-center pr-3 text-xs sm:text-sm text-neutral-500 font-medium">
                        <svg className="mr-1.5 h-4 w-4 text-[#6a17b8] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span className="truncate">{[event.venue_name, event.city].filter(Boolean).join(", ") || "Various"}</span>
                      </div>
                      <div className="shrink-0 text-base sm:text-xl font-semibold text-[#1c1230]">
                        {displayPrice(event)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
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
        bookedCount={selectedEvent?.bookedCount ?? (bookingsMap[selectedEvent?.id] || 0)}
      />
    </section>
  );
}
