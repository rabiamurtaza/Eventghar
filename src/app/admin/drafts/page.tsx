"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

export default function DraftsPage() {
  const [drafts, setDrafts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchDrafts() {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('status', 'draft')
      .order('created_at', { ascending: false });

    if (data) {
      setDrafts(data);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchDrafts();
  }, []);

  const handlePublish = async (id: string | number) => {
    const supabase = createClient();
    const { error } = await supabase
      .from('events')
      .update({ status: 'published' })
      .eq('id', id);
    
    if (!error) {
      // Remove from drafts list
      setDrafts(prev => prev.filter(draft => draft.id !== id));
      alert("Event published successfully!");
    } else {
      alert("Error publishing event: " + error.message);
    }
  };

  const handleDelete = async (id: string | number) => {
    if (!confirm("Are you sure you want to delete this event?")) return;
    
    const supabase = createClient();
    const { error } = await supabase
      .from('events')
      .delete()
      .eq('id', id);
    
    if (!error) {
      setDrafts(prev => prev.filter(draft => draft.id !== id));
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
              Your Drafts
            </h1>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              Events you saved but haven&apos;t published yet.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-neutral-500">Loading drafts...</div>
        ) : drafts.length === 0 ? (
          <div className="rounded-2xl border border-neutral-200 bg-white p-12 text-center shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
            <h3 className="text-lg font-medium text-neutral-900 dark:text-white">No drafts found</h3>
            <p className="mt-1 text-neutral-500 dark:text-neutral-400">You don&apos;t have any unpublished events.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {drafts.map((draft) => (
              <div key={draft.id} className="overflow-hidden rounded-2xl bg-white border border-neutral-200 shadow-sm dark:bg-neutral-900 dark:border-neutral-800 flex flex-col">
                <div className="aspect-video w-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center relative overflow-hidden">
                  {draft.image_url ? (
                    <img src={draft.image_url} alt={draft.title} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-neutral-400 text-sm font-medium">No Image</span>
                  )}
                  <div className="absolute top-4 left-4 rounded bg-neutral-800/80 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm backdrop-blur-sm">
                    DRAFT
                  </div>
                </div>
                
                <div className="p-5 flex flex-col flex-1">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <h3 className="text-lg font-bold text-neutral-900 dark:text-white line-clamp-1">
                      {draft.title || "Untitled Draft"}
                    </h3>
                    {draft.event_number && (
                      <span className="shrink-0 text-xs font-bold px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700">
                        #{draft.event_number}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-neutral-500 dark:text-neutral-400 mb-4 line-clamp-2">
                    {draft.description || "No description provided."}
                  </div>
                  
                  <div className="mt-auto pt-4 border-t border-neutral-100 dark:border-neutral-800 flex flex-col gap-2">
                    <button 
                      onClick={() => handlePublish(draft.id)}
                      className="w-full rounded-lg bg-green-500 py-2 text-sm font-medium text-white transition hover:bg-green-600"
                    >
                      Publish Now
                    </button>
                    <div className="flex gap-2">
                      <Link 
                        href={`/admin/edit-event/${draft.id}`}
                        className="flex-1 text-center rounded-lg bg-neutral-100 dark:bg-neutral-800 py-2 text-sm font-medium text-neutral-900 dark:text-white transition hover:bg-neutral-200 dark:hover:bg-neutral-700"
                      >
                        Edit
                      </Link>
                      <button 
                        onClick={() => handleDelete(draft.id)}
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
    </div>
  );
}

