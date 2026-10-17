"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { getReviewedRequestIds } from "@/utils/requestTracking";
import LiveIndicator from "@/components/LiveIndicator";
import { CardSkeleton } from "@/components/Skeleton";
import { 
  Calendar, 
  Ticket, 
  Users, 
  Inbox, 
  Sparkles, 
  ArrowRight, 
  ShieldCheck, 
  CheckCircle2, 
  Clock, 
  FileEdit,
  Building2,
  AlertCircle
} from "lucide-react";

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
    const supabase = createClient();

    async function fetchDashboardStats() {
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

    // Setup Supabase Realtime for instant metrics updates
    const channel = supabase
      .channel("admin-dashboard-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "events" }, () => fetchDashboardStats())
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, () => fetchDashboardStats())
      .on("postgres_changes", { event: "*", schema: "public", table: "book_event_requests" }, () => fetchDashboardStats())
      .on("postgres_changes", { event: "*", schema: "public", table: "organizers" }, () => fetchDashboardStats())
      .subscribe();

    return () => {
      window.removeEventListener("event-requests-updated", handleUpdate);
      supabase.removeChannel(channel);
    };
  }, []);

  if (loading) {
    return (
      <div className="p-6 sm:p-10 space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <div className="h-8 bg-neutral-200 dark:bg-neutral-800 rounded-lg w-48 mb-2 animate-pulse" />
            <div className="h-4 bg-neutral-200 dark:bg-neutral-800 rounded-md w-72 animate-pulse" />
          </div>
          <LiveIndicator />
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
    );
  }

  const hasUrgentAttention = stats.pendingBookings > 0 || stats.pendingRequests > 0;

  return (
    <div className="p-6 sm:p-10 space-y-8 max-w-7xl mx-auto">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-neutral-200/80 dark:border-neutral-800">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 mb-2">
            <Sparkles className="w-3 h-3" />
            <span>Master Administration Terminal</span>
          </div>
          <h1 className="text-3xl font-black text-neutral-900 dark:text-white tracking-tight">Admin Overview</h1>
          <p className="mt-1 text-xs sm:text-sm text-neutral-500 dark:text-neutral-400">
            Real-time telemetry across Pakistani events, ticket sales, gate verification, and host onboarding.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <LiveIndicator label="Platform Live" />
          <Link
            href="/admin/create-event"
            className="rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:from-emerald-600 hover:to-emerald-700 transition flex items-center gap-1.5"
          >
            <span>+ Create Event</span>
          </Link>
        </div>
      </div>

      {/* Action Notice if Attention Needed */}
      {hasUrgentAttention && (
        <div className="rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/70 dark:bg-amber-950/30 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-amber-900 dark:text-amber-200">
                Action Items Awaiting Verification
              </p>
              <p className="text-xs text-amber-800/80 dark:text-amber-300/80 mt-0.5">
                {stats.pendingBookings > 0 && `${stats.pendingBookings} payment screenshot(s) need review. `}
                {stats.pendingRequests > 0 && `${stats.pendingRequests} inbound event proposal(s) need decision.`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {stats.pendingBookings > 0 && (
              <Link
                href="/admin/bookings"
                className="rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-4 py-2 transition"
              >
                Review Bookings ({stats.pendingBookings})
              </Link>
            )}
            {stats.pendingRequests > 0 && (
              <Link
                href="/admin/requests"
                className="rounded-xl border border-amber-300 dark:border-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/40 text-amber-900 dark:text-amber-200 text-xs font-bold px-4 py-2 transition"
              >
                View Requests ({stats.pendingRequests})
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        
        {/* Metric 1: Total Events */}
        <Link 
          href="/admin/published"
          className="bg-white dark:bg-neutral-900 p-6 rounded-3xl border border-neutral-200/80 dark:border-neutral-800 shadow-xs flex flex-col justify-between hover:border-emerald-500/50 dark:hover:border-emerald-500/50 transition group hover:shadow-md"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                <Calendar className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-bold text-neutral-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition flex items-center gap-1">
                <span>View</span>
                <ArrowRight className="w-3 h-3" />
              </span>
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">Total Events</span>
            <div className="mt-1 text-3xl font-black text-neutral-900 dark:text-white">{stats.totalEvents}</div>
          </div>

          <div className="mt-4 pt-3 border-t border-neutral-100 dark:border-neutral-800/80 flex items-center justify-between text-xs font-medium">
            <span className="text-emerald-600 dark:text-emerald-400 font-bold">{stats.publishedEvents} Live</span>
            <span className="text-neutral-400">•</span>
            <span className="text-neutral-500 dark:text-neutral-400">{stats.draftEvents} Drafts</span>
          </div>
        </Link>

        {/* Metric 2: Tickets Sold */}
        <Link 
          href="/admin/bookings"
          className="bg-white dark:bg-neutral-900 p-6 rounded-3xl border border-neutral-200/80 dark:border-neutral-800 shadow-xs flex flex-col justify-between hover:border-emerald-500/50 dark:hover:border-emerald-500/50 transition group hover:shadow-md"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400">
                <Ticket className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-bold text-neutral-400 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition flex items-center gap-1">
                <span>Manage</span>
                <ArrowRight className="w-3 h-3" />
              </span>
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">Tickets Issued</span>
            <div className="mt-1 text-3xl font-black text-neutral-900 dark:text-white">{stats.totalTicketsSold}</div>
          </div>

          <div className="mt-4 pt-3 border-t border-neutral-100 dark:border-neutral-800/80 text-xs font-medium">
            {stats.pendingBookings > 0 ? (
              <span className="text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>{stats.pendingBookings} pending approval</span>
              </span>
            ) : (
              <span className="text-neutral-500 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                <span>All payments confirmed</span>
              </span>
            )}
          </div>
        </Link>

        {/* Metric 3: Active Organizers */}
        <Link 
          href="/admin/organizers"
          className="bg-white dark:bg-neutral-900 p-6 rounded-3xl border border-neutral-200/80 dark:border-neutral-800 shadow-xs flex flex-col justify-between hover:border-emerald-500/50 dark:hover:border-emerald-500/50 transition group hover:shadow-md"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
                <Users className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-bold text-neutral-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition flex items-center gap-1">
                <span>Directory</span>
                <ArrowRight className="w-3 h-3" />
              </span>
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">Verified Organizers</span>
            <div className="mt-1 text-3xl font-black text-neutral-900 dark:text-white">{stats.totalOrganizers}</div>
          </div>

          <div className="mt-4 pt-3 border-t border-neutral-100 dark:border-neutral-800/80 text-xs text-neutral-500 font-medium">
            Active verified host accounts
          </div>
        </Link>

        {/* Metric 4: Event Requests */}
        <Link 
          href="/admin/requests"
          className="bg-white dark:bg-neutral-900 p-6 rounded-3xl border border-neutral-200/80 dark:border-neutral-800 shadow-xs flex flex-col justify-between hover:border-emerald-500/50 dark:hover:border-emerald-500/50 transition group hover:shadow-md"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
                <Inbox className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-bold text-neutral-400 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition flex items-center gap-1">
                <span>Proposals</span>
                <ArrowRight className="w-3 h-3" />
              </span>
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">Host Inquiries</span>
            <div className="mt-1 text-3xl font-black text-neutral-900 dark:text-white">{stats.pendingRequests}</div>
          </div>

          <div className="mt-4 pt-3 border-t border-neutral-100 dark:border-neutral-800/80 text-xs font-medium">
            {stats.pendingRequests > 0 ? (
              <span className="text-purple-600 dark:text-purple-400 font-bold">New proposals to review</span>
            ) : (
              <span className="text-neutral-500">Inbox all caught up</span>
            )}
          </div>
        </Link>

      </div>

      {/* Quick Navigation Cards */}
      <div>
        <h2 className="text-base font-bold text-neutral-900 dark:text-white mb-4">
          Direct Management Portals
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link
            href="/admin/bookings"
            className="p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 hover:border-emerald-500/60 hover:shadow-sm transition group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 px-2 py-0.5 rounded">
                Checkouts
              </span>
              <span className="text-neutral-400 group-hover:text-emerald-500 transition font-bold text-sm">→</span>
            </div>
            <div className="font-bold text-neutral-900 dark:text-white text-sm">Bookings & Gate Desk</div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
              Verify transaction proofs and issue digital tickets.
            </p>
          </Link>

          <Link
            href="/admin/organizers"
            className="p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 hover:border-emerald-500/60 hover:shadow-sm transition group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 px-2 py-0.5 rounded">
                Access
              </span>
              <span className="text-neutral-400 group-hover:text-emerald-500 transition font-bold text-sm">→</span>
            </div>
            <div className="font-bold text-neutral-900 dark:text-white text-sm">Organizers & Users</div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
              Promote registered users to verified event organizers.
            </p>
          </Link>

          <Link
            href="/admin/published"
            className="p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 hover:border-emerald-500/60 hover:shadow-sm transition group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded">
                Live
              </span>
              <span className="text-neutral-400 group-hover:text-emerald-500 transition font-bold text-sm">→</span>
            </div>
            <div className="font-bold text-neutral-900 dark:text-white text-sm">Published Events</div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
              Manage live public listings, banners, and deadlines.
            </p>
          </Link>

          <Link
            href="/admin/requests"
            className="p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 hover:border-emerald-500/60 hover:shadow-sm transition group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950 px-2 py-0.5 rounded">
                Inbound
              </span>
              <span className="text-neutral-400 group-hover:text-emerald-500 transition font-bold text-sm">→</span>
            </div>
            <div className="font-bold text-neutral-900 dark:text-white text-sm">Host Event Requests</div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
              Review and onboard external event submissions.
            </p>
          </Link>
        </div>
      </div>

    </div>
  );
}
