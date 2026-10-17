"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import QRScannerModal from "@/components/QRScannerModal";
import LiveIndicator from "@/components/LiveIndicator";

export default function PublishedEventsPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [scannerEvent, setScannerEvent] = useState<{ id: string; title: string } | null>(null);

  async function fetchEvents() {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('status', 'published')
      .order('created_at', { ascending: false });

    if (data) {
      setEvents(data);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchEvents();

    const supabase = createClient();
    const channel = supabase
      .channel("admin-published-events-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "events" },
        () => {
          fetchEvents();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleUnpublish = async (id: string | number) => {
    const supabase = createClient();
    const { error } = await supabase
      .from('events')
      .update({ status: 'draft' })
      .eq('id', id);
    
    if (!error) {
      setEvents(prev => prev.filter(e => e.id !== id));
      alert("Event unpublished and moved to drafts!");
    } else {
      alert("Error unpublishing event: " + error.message);
    }
  };

  const handleDelete = async (id: string | number) => {
    if (!confirm("Are you sure you want to delete this event? This action cannot be undone.")) return;
    
    const supabase = createClient();
    const { error } = await supabase
      .from('events')
      .delete()
      .eq('id', id);
    
    if (!error) {
      setEvents(prev => prev.filter(e => e.id !== id));
      alert("Event deleted successfully!");
    } else {
      alert("Error deleting event: " + error.message);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-neutral-900 dark:text-white">
              Published Events
            </h1>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              Manage events that are currently live on the platform.
            </p>
          </div>
          <LiveIndicator />
        </div>

        {loading ? (
          <div className="text-center py-12 text-neutral-500">Loading events...</div>
        ) : events.length === 0 ? (
          <div className="rounded-2xl border border-neutral-200 bg-white p-12 text-center shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
            <h3 className="text-lg font-medium text-neutral-900 dark:text-white">No published events found</h3>
            <p className="mt-1 text-neutral-500 dark:text-neutral-400">You don&apos;t have any live events right now.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map((event) => (
              <div key={event.id} className="overflow-hidden rounded-2xl bg-white border border-neutral-200 shadow-sm dark:bg-neutral-900 dark:border-neutral-800 flex flex-col">
                <div className="aspect-video w-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center relative overflow-hidden">
                  {event.image_url ? (
                    <img src={event.image_url} alt={event.title} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-neutral-400 text-sm font-medium">No Image</span>
                  )}
                  <div className="absolute top-4 left-4 rounded bg-green-500/90 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm backdrop-blur-sm">
                    LIVE
                  </div>
                </div>
                
                <div className="p-5 flex flex-col flex-1">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <h3 className="text-lg font-bold text-neutral-900 dark:text-white line-clamp-1">
                      {event.title || "Untitled Event"}
                    </h3>
                    {event.event_number && (
                      <span className="shrink-0 text-xs font-bold px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700">
                        #{event.event_number}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-neutral-500 dark:text-neutral-400 mb-4 line-clamp-2">
                    {event.description || "No description provided."}
                  </div>
                  
                  <div className="mt-auto pt-4 border-t border-neutral-100 dark:border-neutral-800 flex flex-col gap-2">
                    <button 
                      onClick={() => setScannerEvent({ id: event.id, title: event.title })}
                      className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 py-2.5 text-xs font-bold text-white shadow-sm transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <span>📷</span> Scan Event Tickets
                    </button>
                    <button 
                      onClick={() => handleUnpublish(event.id)}
                      className="w-full rounded-lg bg-neutral-200 dark:bg-neutral-800 py-2 text-sm font-medium text-neutral-800 dark:text-neutral-200 transition hover:bg-neutral-300 dark:hover:bg-neutral-700"
                    >
                      Unpublish (Move to Drafts)
                    </button>
                    <div className="flex gap-2">
                      <Link 
                        href={`/admin/edit-event/${event.id}`}
                        className="flex-1 text-center rounded-lg bg-neutral-100 dark:bg-neutral-800 py-2 text-sm font-medium text-neutral-900 dark:text-white transition hover:bg-neutral-200 dark:hover:bg-neutral-700"
                      >
                        Edit
                      </Link>
                      <button 
                        onClick={() => handleDelete(event.id)}
                        className="flex-1 rounded-lg bg-red-100 dark:bg-red-900/30 py-2 text-sm font-medium text-red-600 dark:text-red-400 transition hover:bg-red-200 dark:hover:bg-red-900/50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Event Scanner Modal */}
      {scannerEvent && (
        <QRScannerModal
          isOpen={true}
          onClose={() => setScannerEvent(null)}
          fixedEventId={scannerEvent.id}
          fixedEventTitle={scannerEvent.title}
        />
      )}
    </div>
  );
}
