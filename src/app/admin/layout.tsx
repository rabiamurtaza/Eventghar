"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import Link from "next/link";
import { getReviewedRequestIds } from "@/utils/requestTracking";
import LiveIndicator from "@/components/LiveIndicator";
import { 
  LayoutDashboard, 
  PlusCircle, 
  CheckCircle2, 
  FileEdit, 
  Users, 
  Ticket, 
  Inbox, 
  MessageSquare, 
  ArrowLeft,
  Sparkles,
  ShieldCheck
} from "lucide-react";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [adminProfile, setAdminProfile] = useState<any>(null);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [pendingBookingsCount, setPendingBookingsCount] = useState(0);
  const [pendingMessagesCount, setPendingMessagesCount] = useState(0);

  useEffect(() => {
    async function checkAdmin() {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push("/");
        return;
      }

      // Check if user is in admins table
      const { data: adminData } = await supabase
        .from('admins')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (!adminData) {
        router.push("/");
        return;
      }

      setIsAuthorized(true);
      setAdminProfile({
        name: session.user.user_metadata?.full_name || 'Administrator',
        email: session.user.email,
        avatar: session.user.user_metadata?.avatar_url || ''
      });

      // Fetch pending requests count (excluding reviewed requests)
      const { data: requestsData } = await supabase
        .from('book_event_requests')
        .select('id, status')
        .eq('status', 'pending');
        
      if (requestsData) {
        const reviewedIds = getReviewedRequestIds();
        const unreviewed = requestsData.filter(r => !reviewedIds.includes(r.id)).length;
        setPendingRequestsCount(unreviewed);
      }

      // Fetch pending bookings count
      const { count: bCount } = await supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');
        
      if (bCount !== null) {
        setPendingBookingsCount(bCount);
      }

      // Fetch pending contact messages count
      try {
        const { count: mCount } = await supabase
          .from('contact_messages')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending');
        if (mCount !== null) {
          setPendingMessagesCount(mCount);
        }
      } catch (e) {}

      setLoading(false);
    }
    checkAdmin();

    const refreshRequestsCount = async () => {
      const supabase = createClient();
      const { data: requestsData } = await supabase
        .from('book_event_requests')
        .select('id, status')
        .eq('status', 'pending');
        
      if (requestsData) {
        const reviewedIds = getReviewedRequestIds();
        const unreviewed = requestsData.filter(r => !reviewedIds.includes(r.id)).length;
        setPendingRequestsCount(unreviewed);
      }
    };

    const refreshBookingsCount = async () => {
      const supabase = createClient();
      const { count: bCount } = await supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');
      if (bCount !== null) {
        setPendingBookingsCount(bCount);
      }
    };

    const refreshMessagesCount = async () => {
      const supabase = createClient();
      try {
        const { count: mCount } = await supabase
          .from('contact_messages')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending');
        if (mCount !== null) {
          setPendingMessagesCount(mCount);
        }
      } catch (e) {}
    };

    window.addEventListener("event-requests-updated", refreshRequestsCount);

    // Setup Supabase Realtime for instant badge counters
    const supabase = createClient();
    const channel = supabase
      .channel("admin-sidebar-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "book_event_requests" },
        () => {
          refreshRequestsCount();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bookings" },
        () => {
          refreshBookingsCount();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "contact_messages" },
        () => {
          refreshMessagesCount();
        }
      )
      .subscribe();

    return () => {
      window.removeEventListener("event-requests-updated", refreshRequestsCount);
      supabase.removeChannel(channel);
    };
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-950 text-neutral-500 dark:text-neutral-400 text-xs font-semibold">
        Verifying Administrative Access...
      </div>
    );
  }

  if (!isAuthorized) {
    return null; 
  }

  const menuItems = [
    { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
    { label: "Create Event", href: "/admin/create-event", icon: PlusCircle },
    { label: "Published Events", href: "/admin/published", icon: CheckCircle2 },
    { label: "View Drafts", href: "/admin/drafts", icon: FileEdit },
    { label: "Users & Organizers", href: "/admin/organizers", icon: Users },
    { label: "Manage Bookings", href: "/admin/bookings", icon: Ticket },
    { label: "Event Requests", href: "/admin/requests", icon: Inbox },
    { label: "Contact Inquiries", href: "/admin/messages", icon: MessageSquare },
  ];

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 flex flex-col md:flex-row">
      
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-white dark:bg-neutral-900 border-r border-neutral-200/80 dark:border-neutral-800 flex flex-col shrink-0">
        
        {/* Admin Profile Section */}
        <div className="p-5 border-b border-neutral-200/80 dark:border-neutral-800">
          <div className="flex items-center gap-3">
            {adminProfile?.avatar ? (
              <img src={adminProfile.avatar} alt="Admin" className="w-10 h-10 rounded-2xl border border-neutral-200 dark:border-neutral-700 object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-white font-black text-sm shadow-sm">
                {adminProfile?.name?.charAt(0) || 'A'}
              </div>
            )}
            <div className="overflow-hidden min-w-0 flex-1">
              <h2 className="text-xs font-bold text-neutral-900 dark:text-white truncate">{adminProfile?.name}</h2>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate">{adminProfile?.email}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="inline-block rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300">
                  Super Admin
                </span>
                <LiveIndicator showText={false} />
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href));
            return (
              <Link 
                key={item.href}
                href={item.href}
                className={`flex items-center justify-between px-3.5 py-2.5 text-xs font-bold rounded-xl transition ${
                  isActive 
                    ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 shadow-xs" 
                    : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-white"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`w-4 h-4 ${isActive ? "text-emerald-600 dark:text-emerald-400" : "text-neutral-400"}`} />
                  <span>{item.label}</span>
                </div>
                {item.label === "Event Requests" && pendingRequestsCount > 0 && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-purple-500 text-[10px] font-black text-white shadow-xs">
                    {pendingRequestsCount}
                  </span>
                )}
                {item.label === "Manage Bookings" && pendingBookingsCount > 0 && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[10px] font-black text-white shadow-xs">
                    {pendingBookingsCount}
                  </span>
                )}
                {item.label === "Contact Inquiries" && pendingMessagesCount > 0 && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-[10px] font-black text-white shadow-xs">
                    {pendingMessagesCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Exit to Public Catalog */}
        <div className="p-3 border-t border-neutral-100 dark:border-neutral-800">
          <Link
            href="/"
            className="flex items-center justify-center gap-2 w-full py-2 px-3 rounded-xl border border-neutral-200 dark:border-neutral-800 text-xs font-semibold text-neutral-600 dark:text-neutral-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Live Catalog</span>
          </Link>
        </div>

      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-x-hidden">
        {children}
      </main>

    </div>
  );
}
