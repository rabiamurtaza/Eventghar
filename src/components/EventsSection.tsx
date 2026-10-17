"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import Link from "next/link";
import LiveIndicator from "@/components/LiveIndicator";

const CITIES = ["All", "Karachi", "Lahore", "Islamabad", "Rawalpindi", "Faisalabad"];
const CATEGORIES = ["All", "Trips", "Qawwali Nights", "Concert", "Music", "Technology", "Food", "Business", "Arts", "Sports", "University Fest", "Workshop"];

export default function EventsSection() {
  const router = useRouter();
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [city, setCity] = useState("All");
  const [category, setCategory] = useState("All");
  const [keyword, setKeyword] = useState("");
  
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);

  // Fetch real events from Supabase with Realtime updates
  useEffect(() => {
    const supabase = createClient();

    async function fetchEvents() {
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

    const channel = supabase
      .channel("public-events-catalog-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "events" },
        () => {
          fetchEvents();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ticket_types" },
        () => {
          fetchEvents();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Prevent background scrolling when modal is open
  useEffect(() => {
    if (selectedEvent) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => { document.body.style.overflow = "unset"; };
  }, [selectedEvent]);

  // Filter logic
  
  const displayPrice = (item: any) => {
    if (!item) return "Free";
    // If passed entire event object
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
        // Find the lowest valid price, or return the first
        const validPrices = parsed.map((t: any) => parseInt(t.price)).filter((p: number) => !isNaN(p));
        if (validPrices.length > 0) {
          const minPrice = Math.min(...validPrices);
          return minPrice === 0 ? "Free" : `From Rs. ${minPrice.toLocaleString()}`;
        }
        return parsed[0].price === "Free" || parsed[0].price === "0" ? "Free" : `Rs. ${parsed[0].price}`;
      }
    } catch(e) {
      // not JSON, fallback to legacy
    }
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
    <section id="events" className="mt-16 scroll-mt-24 pb-20">
      {/* 1. SECTION HEADER */}
      <div className="mb-8 md:mb-12 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            Explore Upcoming Events
          </h2>
          <p className="mt-3 text-lg text-neutral-600">
            Filter by city, category, or search to find exactly what you are looking for.
          </p>
        </div>
        <LiveIndicator />
      </div>

      {/* 2. FILTER BAR */}
      <div className="mb-10 rounded-2xl bg-white p-6 shadow-sm border border-neutral-200  ">
        <div className="flex flex-col gap-4 md:flex-row md:items-end">
          
          <div className="w-full md:w-auto flex-1">
            <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1">City</label>
            <select 
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-purple-600 focus:ring-1 focus:ring-purple-600   "
            >
              {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="w-full md:w-auto flex-1">
            <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1">Category</label>
            <select 
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-purple-600 focus:ring-1 focus:ring-purple-600   "
            >
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>


          <div className="w-full md:w-auto flex-[1.5]">
            <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1">Search</label>
            <div className="flex gap-2">
              <input 
                type="text" 
                placeholder="Keywords..."
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                className="w-full rounded-lg border border-neutral-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-purple-600 focus:ring-1 focus:ring-purple-600   "
              />
            </div>
          </div>

        </div>
      </div>

      {/* 3. EVENT GRID */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="overflow-hidden rounded-2xl bg-white border border-neutral-200 shadow-sm p-4 animate-pulse">
              <div className="aspect-video w-full bg-neutral-200 rounded-xl mb-4" />
              <div className="h-4 bg-neutral-200 rounded w-1/3 mb-2" />
              <div className="h-6 bg-neutral-200 rounded w-2/3 mb-4" />
              <div className="flex justify-between items-center">
                <div className="h-4 bg-neutral-200 rounded w-1/4" />
                <div className="h-4 bg-neutral-200 rounded w-1/4" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredEvents.length > 0 ? (
            filteredEvents.map((event) => (
              <div 
                key={event.id} 
                onClick={() => setSelectedEvent(event)}
                className="group relative overflow-hidden rounded-2xl bg-white border border-neutral-200 shadow-sm transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-purple-900/20 cursor-pointer   flex flex-col"
              >
                {/* Image Area */}
                <div className="aspect-video w-full bg-neutral-100  flex items-center justify-center relative overflow-hidden">
                  {event.image_url ? (
                    <img src={event.image_url} alt={event.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  ) : (
                    <span className="text-slate-600  text-sm font-medium">No Image</span>
                  )}
                  {event.status === "published" && (
                     <div className="absolute top-4 left-4 z-10 rounded bg-purple-700 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm">
                       LIVE
                     </div>
                  )}
                </div>
                
                <div className="p-6 flex flex-col flex-1">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-bold text-purple-400 dark:text-green-400 flex items-center gap-1.5">
                      {event.event_number && (
                        <span className="text-xs px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 font-bold">
                          #{event.event_number}
                        </span>
                      )}
                      {event.start_date || "TBD"}
                    </span>
                    <span className="inline-flex items-center rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-semibold text-neutral-600  ">
                      {event.category || "Uncategorized"}
                    </span>
                  </div>
                  
                  <h3 className="text-xl font-bold text-slate-900  mb-4 line-clamp-2">
                    <span className="capitalize">{event.title || "Untitled Event"}</span>
                  </h3>
                  
                  <div className="mt-auto flex items-center justify-between text-neutral-500 ">
                    <div className="flex items-center text-sm font-medium">
                      <svg className="mr-1.5 h-4 w-4 text-slate-600 " fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      {event.city || "Various"}
                    </div>
                    <div className="text-sm font-bold text-slate-900 ">
                      {displayPrice(event)}
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full py-12 text-center text-neutral-500 ">
              No events found matching your filters.
            </div>
          )}
        </div>
      )}

      {/* 4. MODAL FOR EVENT DETAILS */}
      {selectedEvent && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" 
            onClick={() => setSelectedEvent(null)}
          />
          
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white  border border-neutral-200  shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <button 
              onClick={() => setSelectedEvent(null)}
              className="absolute right-4 top-4 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-slate-900 hover:bg-black transition"
            >
              ✕
            </button>

            <div className="aspect-video w-full bg-neutral-100  flex items-center justify-center relative">
              {selectedEvent.image_url ? (
                <img src={selectedEvent.image_url} alt={selectedEvent.title || "Event Image"} className="w-full h-full object-cover" />
              ) : (
                <span className="text-slate-600  font-medium">No Image</span>
              )}
            </div>

            <div className="p-6 sm:p-8">
              <div className="mb-4 flex items-center gap-3">
                <span className="rounded-full bg-purple-50 px-3 py-1 text-xs font-semibold text-purple-300 dark:bg-green-950/50 dark:text-green-400 border border-purple-700/50 dark:border-green-900/50">
                  {selectedEvent.category || "Event"}
                </span>
                <span className="text-sm font-medium text-neutral-500 ">{selectedEvent.city}</span>
              </div>

              <h2 className="mb-2 text-2xl font-bold text-slate-900  sm:text-3xl"><span className="capitalize">{selectedEvent.title}</span></h2>
              <p className="mb-6 text-neutral-600  leading-relaxed whitespace-pre-wrap">{selectedEvent.description}</p>
              
              <div className="mb-8 grid grid-cols-2 gap-4 rounded-xl bg-slate-50  p-4 border border-neutral-200 ">
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500">Date</p>
                  <p className="font-medium text-slate-900 ">{selectedEvent.start_date || "TBD"}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500">Time</p>
                  <p className="font-medium text-slate-900 ">{selectedEvent.start_time || "TBD"}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs font-semibold uppercase text-neutral-500">Venue</p>
                  <p className="font-medium text-slate-900 ">{selectedEvent.venue_name || "TBD"}</p>
                </div>
                {selectedEvent.google_maps_link && (
                  <div className="col-span-2 mt-2">
                    <a href={selectedEvent.google_maps_link} target="_blank" rel="noopener noreferrer" className="text-sm text-purple-400 hover:underline">
                      View on Google Maps ↗
                    </a>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-neutral-500 ">Ticket Price</p>
                  <p className="text-2xl font-bold text-slate-900 ">
                    {displayPrice(selectedEvent)}
                  </p>
                </div>
                <button 
                  onClick={() => handleBookTicketClick(selectedEvent)} 
                  className="rounded-xl bg-purple-700 px-8 py-3 font-bold text-white transition hover:bg-purple-600 hover:-translate-y-1 active:translate-y-0 shadow-lg shadow-purple-500/30 text-center cursor-pointer"
                >
                  Book Tickets
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}



