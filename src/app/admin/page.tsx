"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { getReviewedRequestIds } from "@/utils/requestTracking";

export default function AdminDashboardPage() {
  const [stats, setStats] = useState({
    totalEvents: 0,
    publishedEvents: 0,
    draftEvents: 0,
    totalTicketsSold: 0,
    pendingBookings: 0,
    pendingRequests: 0,
    totalOrganizers: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboardStats() {
      const supabase = createClient();

      // 1. Fetch Events Stats & Organizers Count
      const [eventsRes, orgsRes] = await Promise.all([
        supabase.from('events').select('status, organizer_contact'),
        supabase.from('organizers').select('*', { count: 'exact', head: true })
      ]);
      const eventsData = eventsRes.data;
      
      let totalEvents = 0;
      let publishedEvents = 0;
      let draftEvents = 0;
      const uniqueOrganizers = new Set();

      if (eventsData) {
        totalEvents = eventsData.length;
        eventsData.forEach(evt => {
          if (evt.status === 'published') publishedEvents++;
          if (evt.status === 'draft') draftEvents++;
          if (evt.organizer_contact) uniqueOrganizers.add(evt.organizer_contact);
        });
      }

      const totalOrganizersCount = (orgsRes.count !== null && orgsRes.count !== undefined) 
        ? orgsRes.count 
        : uniqueOrganizers.size;

      // 2. Fetch Tickets Sold & Pending Bookings
      const { data: bookingsData } = await supabase
        .from('bookings')
        .select('number_of_tickets, status');

      let totalTicketsSold = 0;
      let pendingBookings = 0;
      if (bookingsData) {
        bookingsData.forEach(b => {
          if (b.status === 'verified' || b.status === 'confirmed') {
            totalTicketsSold += (b.number_of_tickets || 0);
          }
          if (b.status === 'pending') {
            pendingBookings++;
          }
        });
      }

      // 3. Fetch Pending Event Requests
      const { data: requestsData } = await supabase
        .from('book_event_requests')
        .select('id, status')
        .eq('status', 'pending');

      const reviewedIds = getReviewedRequestIds();
      const pendingRequestsCount = requestsData ? requestsData.filter(r => !reviewedIds.includes(r.id)).length : 0;

      setStats({
        totalEvents,
        publishedEvents,
        draftEvents,
        totalTicketsSold,
        pendingBookings,
        pendingRequests: pendingRequestsCount,
        totalOrganizers: totalOrganizersCount
      });
      setLoading(false);
    }
    
    fetchDashboardStats();

    const handleUpdate = () => {
      fetchDashboardStats();
    };

    window.addEventListener("event-requests-updated", handleUpdate);
    return () => {
      window.removeEventListener("event-requests-updated", handleUpdate);
    };
  }, []);

  if (loading) {
    return <div className="p-10 text-neutral-500">Loading dashboard metrics...</div>;
  }

  return (
    <div className="p-6 sm:p-10">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-neutral-900 dark:text-white">Admin Dashboard</h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          Overview of how Event Ghar is performing right now.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        
        {/* Metric 1 */}
        <Link 
          href="/admin/published"
          className="bg-white dark:bg-neutral-900 p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm flex flex-col hover:border-indigo-400 dark:hover:border-indigo-500 transition group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-neutral-500 dark:text-neutral-400">Total Events</span>
            <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 group-hover:underline">View All →</span>
          </div>
          <span className="text-4xl font-extrabold text-neutral-900 dark:text-white">{stats.totalEvents}</span>
          <div className="mt-4 flex items-center gap-2 text-xs font-medium text-neutral-500">
            <span className="text-green-600 dark:text-green-400">{stats.publishedEvents} Published</span>
            <span>•</span>
            <span className="text-yellow-600 dark:text-yellow-400">{stats.draftEvents} Drafts</span>
          </div>
        </Link>

        {/* Metric 2: Manage Bookings & Tickets */}
        <Link 
          href="/admin/bookings"
          className="bg-white dark:bg-neutral-900 p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm flex flex-col hover:border-indigo-400 dark:hover:border-indigo-500 transition group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-neutral-500 dark:text-neutral-400">Manage Bookings</span>
            <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 group-hover:underline">Manage →</span>
          </div>
          <span className="text-4xl font-extrabold text-indigo-600 dark:text-indigo-400">{stats.totalTicketsSold}</span>
          <div className="mt-4 flex items-center gap-2 text-xs font-medium text-neutral-500">
            {stats.pendingBookings > 0 ? (
              <span className="text-amber-600 dark:text-amber-400 font-semibold">{stats.pendingBookings} pending verification</span>
            ) : (
              <span className="text-neutral-500">All tickets confirmed</span>
            )}
          </div>
        </Link>

        {/* Metric 3: Active Organizers */}
        <Link 
          href="/admin/organizers"
          className="bg-white dark:bg-neutral-900 p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm flex flex-col hover:border-indigo-400 dark:hover:border-indigo-500 transition group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-neutral-500 dark:text-neutral-400">Users & Organizers</span>
            <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 group-hover:underline">Manage Roles →</span>
          </div>
          <span className="text-4xl font-extrabold text-neutral-900 dark:text-white">{stats.totalOrganizers}</span>
          <div className="mt-4 flex items-center gap-2 text-xs font-medium text-neutral-500">
            Active organizers hosting events
          </div>
        </Link>

        {/* Metric 4: Event Requests */}
        <Link 
          href="/admin/requests"
          className="bg-white dark:bg-neutral-900 p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm flex flex-col hover:border-indigo-400 dark:hover:border-indigo-500 transition group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-neutral-500 dark:text-neutral-400">Event Requests</span>
            <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 group-hover:underline">Review →</span>
          </div>
          <span className="text-4xl font-extrabold text-red-500 dark:text-red-400">{stats.pendingRequests}</span>
          <div className="mt-4 flex items-center gap-2 text-xs font-medium text-neutral-500">
            {stats.pendingRequests > 0 ? "Pending approval" : "All caught up"}
          </div>
        </Link>

      </div>

      {/* Quick Management Section */}
      <div className="mt-10">
        <h2 className="text-lg font-bold text-neutral-900 dark:text-white mb-4">Quick Management</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link
            href="/admin/organizers"
            className="p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 hover:border-indigo-500 hover:shadow-md transition group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">Directory</span>
              <span className="text-neutral-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition font-bold text-sm">→</span>
            </div>
            <div className="font-bold text-neutral-900 dark:text-white text-base mt-2">Organizers List</div>
            <div className="text-xs text-neutral-500 mt-1">View organizer profiles & hosted events</div>
          </Link>

          <Link
            href="/admin/bookings"
            className="p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 hover:border-indigo-500 hover:shadow-md transition group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">Bookings</span>
              <span className="text-neutral-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition font-bold text-sm">→</span>
            </div>
            <div className="font-bold text-neutral-900 dark:text-white text-base mt-2">Manage Bookings</div>
            <div className="text-xs text-neutral-500 mt-1">Verify payment receipts & ticket requests</div>
          </Link>

          <Link
            href="/admin/published"
            className="p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 hover:border-indigo-500 hover:shadow-md transition group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-green-600 dark:text-green-400">Events</span>
              <span className="text-neutral-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition font-bold text-sm">→</span>
            </div>
            <div className="font-bold text-neutral-900 dark:text-white text-base mt-2">Published Events</div>
            <div className="text-xs text-neutral-500 mt-1">Edit live events or change status</div>
          </Link>

          <Link
            href="/admin/requests"
            className="p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 hover:border-indigo-500 hover:shadow-md transition group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-red-600 dark:text-red-400">Requests</span>
              <span className="text-neutral-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition font-bold text-sm">→</span>
            </div>
            <div className="font-bold text-neutral-900 dark:text-white text-base mt-2">Event Requests</div>
            <div className="text-xs text-neutral-500 mt-1">Review event submissions from users</div>
          </Link>
        </div>
      </div>
    </div>
  );
}
