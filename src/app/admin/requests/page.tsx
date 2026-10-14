"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { 
  getReviewedRequestIds, 
  markRequestAsReviewed, 
  markAllRequestsAsReviewed, 
  markRequestAsPending 
} from "@/utils/requestTracking";

export default function AdminEventRequestsPage() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"all" | "unreviewed" | "reviewed">("all");
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
  const [reviewedIds, setReviewedIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");

  async function fetchRequests() {
    const supabase = createClient();
    const { data } = await supabase
      .from('book_event_requests')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (data) {
      setRequests(data);
    }
    setReviewedIds(getReviewedRequestIds());
    setLoading(false);
  }

  useEffect(() => {
    fetchRequests();

    const handleUpdate = () => {
      setReviewedIds(getReviewedRequestIds());
    };
    window.addEventListener("event-requests-updated", handleUpdate);
    return () => window.removeEventListener("event-requests-updated", handleUpdate);
  }, []);

  const isReviewed = (req: any) => {
    if (req.status && req.status !== 'pending') return true;
    return reviewedIds.includes(req.id);
  };

  const handleOpenRequest = async (req: any) => {
    setSelectedRequest(req);
    // Automatically mark as reviewed when opened/viewed
    if (!isReviewed(req)) {
      markRequestAsReviewed(req.id);
      setReviewedIds(prev => [...prev, req.id]);
      
      // Also update database status
      const supabase = createClient();
      await supabase.from('book_event_requests').update({ status: 'reviewed' }).eq('id', req.id);
      setRequests(prev => prev.map(r => r.id === req.id ? { ...r, status: 'reviewed' } : r));
    }
  };

  const handleToggleReviewed = async (req: any, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const currentIsReviewed = isReviewed(req);
    const supabase = createClient();

    if (currentIsReviewed) {
      markRequestAsPending(req.id);
      setReviewedIds(prev => prev.filter(id => id !== req.id));
      await supabase.from('book_event_requests').update({ status: 'pending' }).eq('id', req.id);
      setRequests(prev => prev.map(r => r.id === req.id ? { ...r, status: 'pending' } : r));
      if (selectedRequest && selectedRequest.id === req.id) {
        setSelectedRequest({ ...selectedRequest, status: 'pending' });
      }
    } else {
      markRequestAsReviewed(req.id);
      setReviewedIds(prev => [...prev, req.id]);
      await supabase.from('book_event_requests').update({ status: 'reviewed' }).eq('id', req.id);
      setRequests(prev => prev.map(r => r.id === req.id ? { ...r, status: 'reviewed' } : r));
      if (selectedRequest && selectedRequest.id === req.id) {
        setSelectedRequest({ ...selectedRequest, status: 'reviewed' });
      }
    }
  };

  const handleMarkAllReviewed = async () => {
    const allIds = requests.map(r => r.id);
    markAllRequestsAsReviewed(allIds);
    setReviewedIds(allIds);

    const supabase = createClient();
    await supabase.from('book_event_requests').update({ status: 'reviewed' }).in('id', allIds);
    setRequests(prev => prev.map(r => ({ ...r, status: 'reviewed' })));
  };

  const unreviewedCount = requests.filter(r => !isReviewed(r)).length;
  const reviewedCount = requests.filter(r => isReviewed(r)).length;

  const filteredRequests = requests.filter(req => {
    const matchesTab = 
      activeTab === "all" || 
      (activeTab === "unreviewed" && !isReviewed(req)) || 
      (activeTab === "reviewed" && isReviewed(req));

    const matchesSearch = 
      !search || 
      req.title?.toLowerCase().includes(search.toLowerCase()) ||
      req.organizer_name?.toLowerCase().includes(search.toLowerCase()) ||
      req.organizer_contact?.toLowerCase().includes(search.toLowerCase()) ||
      req.city?.toLowerCase().includes(search.toLowerCase());

    return matchesTab && matchesSearch;
  });

  if (loading) return <div className="p-8 text-neutral-500">Loading requests...</div>;

  return (
    <div className="p-6 sm:p-10">
      
      {/* Page Header */}
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold text-neutral-900 dark:text-white">Event Requests</h1>
            {unreviewedCount > 0 && (
              <span className="flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-900/40 px-2.5 py-0.5 text-xs font-bold text-red-600 dark:text-red-400">
                <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse"></span>
                {unreviewedCount} New
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            Review event hosting requests submitted by users. Opening a request marks it as reviewed.
          </p>
        </div>

        {/* Header Actions */}
        {unreviewedCount > 0 && (
          <button
            onClick={handleMarkAllReviewed}
            className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-4 py-2.5 text-xs font-semibold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition shadow-sm flex items-center gap-2 self-start md:self-auto"
          >
            <span>✓</span> Mark All as Reviewed
          </button>
        )}
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="mb-6 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        
        {/* Tabs */}
        <div className="flex rounded-xl bg-neutral-100 dark:bg-neutral-800/60 p-1 self-start">
          <button
            onClick={() => setActiveTab("all")}
            className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition ${
              activeTab === "all"
                ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-900 dark:text-white"
                : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
            }`}
          >
            All ({requests.length})
          </button>

          <button
            onClick={() => setActiveTab("unreviewed")}
            className={`flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-semibold transition ${
              activeTab === "unreviewed"
                ? "bg-white text-red-600 shadow-sm dark:bg-neutral-900 dark:text-red-400"
                : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
            }`}
          >
            <span>Unreviewed</span>
            {unreviewedCount > 0 && (
              <span className="rounded-full bg-red-500 px-1.5 py-0.2 text-[10px] font-bold text-white">
                {unreviewedCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("reviewed")}
            className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition ${
              activeTab === "reviewed"
                ? "bg-white text-green-600 shadow-sm dark:bg-neutral-900 dark:text-green-400"
                : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
            }`}
          >
            Reviewed ({reviewedCount})
          </button>
        </div>

        {/* Search */}
        <div className="relative max-w-xs w-full">
          <input
            type="text"
            placeholder="Search requests..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-2 text-xs outline-none focus:border-indigo-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-2 text-neutral-400 hover:text-neutral-600 text-xs"
            >
              ✕
            </button>
          )}
        </div>

      </div>

      {/* Table Area */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-neutral-600 dark:text-neutral-400">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:border-neutral-800 dark:bg-neutral-950/50">
              <tr>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Proposed Event</th>
                <th className="px-6 py-4">Organizer</th>
                <th className="px-6 py-4">Date & Location</th>
                <th className="px-6 py-4">Tickets</th>
                <th className="px-6 py-4">Submitted</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-neutral-500">
                    No event requests found in this view.
                  </td>
                </tr>
              ) : (
                filteredRequests.map((req) => {
                  const reviewed = isReviewed(req);
                  return (
                    <tr 
                      key={req.id} 
                      onClick={() => handleOpenRequest(req)}
                      className={`cursor-pointer transition ${
                        reviewed 
                          ? "hover:bg-neutral-50 dark:hover:bg-neutral-800/40" 
                          : "bg-red-50/30 dark:bg-red-950/10 hover:bg-red-50/60 dark:hover:bg-red-950/20"
                      }`}
                    >
                      {/* Status */}
                      <td className="px-6 py-4">
                        {reviewed ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 dark:bg-green-900/30 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-green-700 dark:text-green-400">
                            ✓ Reviewed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-900/40 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-700 dark:text-red-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse"></span>
                            New
                          </span>
                        )}
                      </td>

                      {/* Event */}
                      <td className="px-6 py-4">
                        <div className={`font-bold ${reviewed ? 'text-neutral-900 dark:text-white' : 'text-neutral-950 dark:text-white'}`}>
                          {req.title}
                        </div>
                        <div className="text-xs text-neutral-500">{req.category}</div>
                      </td>

                      {/* Organizer */}
                      <td className="px-6 py-4">
                        <div className="font-semibold text-neutral-900 dark:text-white">{req.organizer_name}</div>
                        <div className="text-xs text-neutral-500">{req.organizer_contact}</div>
                      </td>

                      {/* Location & Date */}
                      <td className="px-6 py-4">
                        <div className="text-neutral-900 dark:text-neutral-300">{req.city}</div>
                        <div className="text-xs text-neutral-500">{req.venue_name || 'TBD'} • {req.start_date || 'TBD'}</div>
                      </td>

                      {/* Tickets */}
                      <td className="px-6 py-4 font-semibold text-neutral-900 dark:text-white">
                        {req.expected_tickets ? req.expected_tickets.toLocaleString() : 'N/A'}
                      </td>

                      {/* Submitted At */}
                      <td className="px-6 py-4 text-xs">
                        {new Date(req.created_at).toLocaleDateString()}
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => handleOpenRequest(req)}
                            className="rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 px-3 py-1.5 text-xs font-semibold hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition"
                          >
                            View
                          </button>
                          <button
                            onClick={(e) => handleToggleReviewed(req, e)}
                            title={reviewed ? "Mark as Unreviewed" : "Mark as Reviewed"}
                            className="text-xs font-semibold text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 p-1"
                          >
                            {reviewed ? "Undo" : "✓ Done"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Request Details Modal */}
      {selectedRequest && (
        <div 
          onClick={() => setSelectedRequest(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="relative max-h-[90vh] max-w-xl w-full bg-white dark:bg-neutral-900 rounded-2xl overflow-hidden shadow-2xl border border-neutral-200 dark:border-neutral-800 flex flex-col"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
                  {selectedRequest.category || 'Event Request'}
                </span>
                {isReviewed(selectedRequest) ? (
                  <span className="text-xs font-semibold text-green-600 dark:text-green-400">✓ Reviewed</span>
                ) : (
                  <span className="text-xs font-semibold text-amber-600">Pending Review</span>
                )}
              </div>
              <button 
                onClick={() => setSelectedRequest(null)}
                className="h-8 w-8 rounded-lg flex items-center justify-center text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5">
              <div>
                <h2 className="text-2xl font-black text-neutral-900 dark:text-white">
                  {selectedRequest.title}
                </h2>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Submitted on {new Date(selectedRequest.created_at).toLocaleString()}
                </p>
              </div>

              {/* Organizer Card */}
              <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700/50">
                <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2">Organizer Details</h4>
                <div className="font-bold text-neutral-900 dark:text-white text-base">
                  {selectedRequest.organizer_name}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-xs">
                  <a 
                    href={`mailto:${selectedRequest.organizer_contact}`} 
                    className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
                  >
                    ✉ {selectedRequest.organizer_contact}
                  </a>
                </div>
              </div>

              {/* Event Details Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950/50">
                  <span className="text-[11px] font-semibold text-neutral-400 block">City & Venue</span>
                  <span className="text-sm font-bold text-neutral-900 dark:text-white block mt-0.5">
                    {selectedRequest.city} • {selectedRequest.venue_name || 'TBD'}
                  </span>
                </div>

                <div className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950/50">
                  <span className="text-[11px] font-semibold text-neutral-400 block">Proposed Start Date</span>
                  <span className="text-sm font-bold text-neutral-900 dark:text-white block mt-0.5">
                    {selectedRequest.start_date || 'Flexible / TBD'}
                  </span>
                </div>

                <div className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950/50">
                  <span className="text-[11px] font-semibold text-neutral-400 block">Expected Tickets</span>
                  <span className="text-sm font-bold text-neutral-900 dark:text-white block mt-0.5">
                    {selectedRequest.expected_tickets ? selectedRequest.expected_tickets.toLocaleString() : 'Not specified'}
                  </span>
                </div>

                <div className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950/50">
                  <span className="text-[11px] font-semibold text-neutral-400 block">Category</span>
                  <span className="text-sm font-bold text-neutral-900 dark:text-white block mt-0.5">
                    {selectedRequest.category || 'General'}
                  </span>
                </div>
              </div>

              {/* Description */}
              {selectedRequest.description && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-1.5">Description</h4>
                  <div className="text-sm text-neutral-700 dark:text-neutral-300 bg-neutral-50 dark:bg-neutral-800/40 p-3.5 rounded-xl whitespace-pre-wrap">
                    {selectedRequest.description}
                  </div>
                </div>
              )}

              {/* Additional Notes */}
              {selectedRequest.additional_notes && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-1.5">Additional Notes</h4>
                  <div className="text-xs text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/30 p-3.5 rounded-xl border border-indigo-200 dark:border-indigo-900/30 whitespace-pre-wrap">
                    {selectedRequest.additional_notes}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
              <button
                onClick={() => handleToggleReviewed(selectedRequest)}
                className="text-xs font-semibold text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 transition"
              >
                {isReviewed(selectedRequest) ? "Mark as Unreviewed" : "Mark as Reviewed"}
              </button>

              <button
                onClick={() => setSelectedRequest(null)}
                className="rounded-xl bg-neutral-100 dark:bg-neutral-800 px-4 py-2 text-xs font-bold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
