"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import Link from "next/link";

import { getReviewedRequestIds } from "@/utils/requestTracking";

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
        name: session.user.user_metadata?.full_name || 'Admin',
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

    const handleRequestsUpdated = async () => {
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

    window.addEventListener("event-requests-updated", handleRequestsUpdated);
    return () => {
      window.removeEventListener("event-requests-updated", handleRequestsUpdated);
    };
  }, [router]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-950 dark:text-white">Verifying Admin Access...</div>;
  }

  if (!isAuthorized) {
    return null; 
  }

  const menuItems = [
    { label: "Dashboard", href: "/admin" },
    { label: "Create Event", href: "/admin/create-event" },
    { label: "Edit / Published Events", href: "/admin/published" },
    { label: "View Drafts", href: "/admin/drafts" },
    { label: "Users & Organizers", href: "/admin/organizers" },
    { label: "Manage Bookings", href: "/admin/bookings" },
    { label: "Event Requests", href: "/admin/requests" },
    { label: "Contact Inquiries", href: "/admin/messages" },
  ];

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 flex flex-col md:flex-row">
      
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-white dark:bg-neutral-900 border-r border-neutral-200 dark:border-neutral-800 flex flex-col shrink-0">
        
        {/* Admin Profile Section */}
        <div className="p-6 border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center gap-3">
            {adminProfile?.avatar ? (
              <img src={adminProfile.avatar} alt="Admin" className="w-12 h-12 rounded-full border border-neutral-200 dark:border-neutral-700 object-cover" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-xl border border-indigo-200 dark:border-indigo-800/30">
                {adminProfile?.name?.charAt(0) || 'A'}
              </div>
            )}
            <div className="overflow-hidden">
              <h2 className="text-sm font-bold text-neutral-900 dark:text-white truncate">{adminProfile?.name}</h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">{adminProfile?.email}</p>
              <span className="inline-block mt-1 rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400">
                Administrator
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {menuItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href));
            return (
              <Link 
                key={item.href}
                href={item.href}
                className={`flex items-center justify-between px-4 py-3 text-sm font-medium rounded-xl transition ${
                  isActive 
                    ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400" 
                    : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-white"
                }`}
              >
                <div className="flex items-center gap-3">
                  {item.label}
                </div>
                {item.label === "Event Requests" && pendingRequestsCount > 0 && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[11px] font-bold text-white shadow-sm">
                    {pendingRequestsCount}
                  </span>
                )}
                {item.label === "Manage Bookings" && pendingBookingsCount > 0 && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[11px] font-bold text-white shadow-sm">
                    {pendingBookingsCount}
                  </span>
                )}
                {item.label === "Contact Inquiries" && pendingMessagesCount > 0 && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-[11px] font-bold text-white shadow-sm">
                    {pendingMessagesCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-x-hidden">
        {children}
      </main>

    </div>
  );
}
