"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import QRScannerModal from "@/components/QRScannerModal";
import { deleteEventCascade } from "@/utils/eventService";

export default function PublishedEventsPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [scannerEvent, setScannerEvent] = useState<{ id: string; title: string } | null>(null);
  const [eventToDelete, setEventToDelete] = useState<{ id: string | number; title: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

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
  }, []);

  const handleUnpublish = async (id: string | number) => {
    const supabase = createClient();
    const { error } = await supabase
      .from('events')
      .update({ status: 'draft' })
      .eq('id', id);
    
    if (!error) {
      setEvents(prev => prev.filter(e => e.id !== id));
      setFeedbackMsg({ type: "success", text: "Event unpublished and moved to drafts!" });
    } else {
      setFeedbackMsg({ type: "error", text: "Error unpublishing event: " + error.message });
    }
  };

  const confirmDeleteEvent = async () => {
    if (!eventToDelete) return;
    setIsDeleting(true);
    setFeedbackMsg(null);
    const supabase = createClient();

    const result = await deleteEventCascade(supabase, eventToDelete.id);

    if (result.success) {
      setEvents(prev => prev.filter(e => e.id !== eventToDelete.id));
      setFeedbackMsg({
        type: "success",
        text: `Event "${eventToDelete.title}" and all related bookings/tickets were permanently deleted.`,
      });
      setEventToDelete(null);
    } else {
      setFeedbackMsg({
        type: "error",
        text: result.error || "Failed to delete event.",
      });
    }
    setIsDeleting(false);
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
        </div>

        {feedbackMsg && (
          <div
            className={`mb-6 p-4 rounded-xl text-sm font-medium border flex items-center justify-between ${
              feedbackMsg.type === "success"
                ? "bg-green-50 text-green-800 border-green-200 dark:bg-green-950/40 dark:text-green-300 dark:border-green-800"
                : "bg-red-50 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800"
            }`}
          >
            <span>{feedbackMsg.text}</span>
            <button
              onClick={() => setFeedbackMsg(null)}
              className="text-xs font-bold hover:opacity-70 ml-4"
            >
              ✕
            </button>
          </div>
        )}

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
                      className="w-full rounded-lg bg-indigo-600 hover:bg-indigo-700 py-2 text-sm font-semibold text-white shadow-sm transition flex items-center justify-center gap-1.5"
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
                        onClick={() => setEventToDelete({ id: event.id, title: event.title || "Untitled Event" })}
                        className="flex-1 rounded-lg bg-red-100 dark:bg-red-900/30 py-2 text-sm font-semibold text-red-600 dark:text-red-400 transition hover:bg-red-200 dark:hover:bg-red-900/50"
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

      {/* Delete Permanently Confirmation Modal */}
      {eventToDelete && (
        <div
          onClick={() => !isDeleting && setEventToDelete(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-6 shadow-2xl text-[#1c1230] dark:text-white animate-in zoom-in-95 duration-150"
          >
            <div className="flex items-center gap-3 mb-4 text-red-600 dark:text-red-400">
              <div className="h-10 w-10 rounded-full bg-red-100 dark:bg-red-950/60 flex items-center justify-center shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold">Delete permanently?</h3>
                <p className="text-xs text-red-600 dark:text-red-400 font-medium">This action cannot be undone.</p>
              </div>
            </div>

            <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-6 leading-relaxed">
              Are you sure you want to delete <strong className="text-neutral-900 dark:text-white">&quot;{eventToDelete.title}&quot;</strong>? Everything related to this event—including all attendee bookings, payment records, and issued QR tickets—will be permanently deleted.
            </p>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setEventToDelete(null)}
                className="rounded-xl px-4 py-2 text-sm font-semibold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition disabled:opacity-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={confirmDeleteEvent}
                className="rounded-xl bg-red-600 hover:bg-red-700 text-white px-5 py-2 text-sm font-bold transition shadow-md shadow-red-600/20 disabled:opacity-50 flex items-center gap-2 cursor-pointer"
              >
                {isDeleting ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                    </svg>
                    Deleting...
                  </>
                ) : (
                  "Delete Permanently"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

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
