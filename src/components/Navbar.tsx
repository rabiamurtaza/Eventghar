"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";

export default function Navbar() {
  const [isUserOpen, setIsUserOpen] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const userDropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        userDropdownRef.current &&
        !userDropdownRef.current.contains(event.target as Node)
      ) {
        setIsUserOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    
    const supabase = createClient();
    
    const checkUserRole = async (userId: string) => {
      const { data: admin } = await supabase.from('admins').select('id').eq('id', userId).single();
      if (admin) return 'admin';
      
      const { data: organizer } = await supabase.from('organizers').select('id').eq('id', userId).single();
      if (organizer) return 'organizer';
      
      return 'user';
    };

    let roleChannel: any = null;

    const setupRoleChannel = (userId: string) => {
      if (roleChannel) supabase.removeChannel(roleChannel);
      roleChannel = supabase
        .channel(`user-role-${userId}-realtime`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "organizers", filter: `id=eq.${userId}` },
          async () => {
            const role = await checkUserRole(userId);
            setUserRole(role);
          }
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "admins", filter: `id=eq.${userId}` },
          async () => {
            const role = await checkUserRole(userId);
            setUserRole(role);
          }
        )
        .subscribe();
    };

    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session) {
        const role = await checkUserRole(data.session.user.id);
        setUserRole(role);
        setupRoleChannel(data.session.user.id);
      }
    });
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      if (session) {
        const role = await checkUserRole(session.user.id);
        setUserRole(role);
        setupRoleChannel(session.user.id);
      } else {
        setUserRole(null);
        if (roleChannel) supabase.removeChannel(roleChannel);
      }
    });

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      subscription.unsubscribe();
      if (roleChannel) supabase.removeChannel(roleChannel);
    };
  }, []);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setIsUserOpen(false);
    window.location.href = "/";
  };

  const handleLoggedOutRequestEvent = () => {
    const msg = encodeURIComponent("Please log in or create an account first to request an event.");
    router.push(`/login?redirect=${encodeURIComponent('/book-event')}&message=${msg}`);
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-800/80 bg-slate-950/85 text-white backdrop-blur-xl transition-all">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Left Side: Brand Name */}
        <div className="flex items-center gap-6">
          <Link
            href="/"
            className="flex items-center gap-2.5 text-lg sm:text-xl font-extrabold tracking-tight transition hover:opacity-95 group"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 text-white shadow-lg shadow-indigo-500/25 group-hover:scale-105 transition-transform duration-200">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5"
              >
                <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
                <line x1="16" x2="16" y1="2" y2="6" />
                <line x1="8" x2="8" y1="2" y2="6" />
                <line x1="3" x2="21" y1="10" y2="10" />
              </svg>
            </span>
            <span className="bg-gradient-to-r from-white via-slate-100 to-indigo-200 bg-clip-text text-transparent font-black tracking-tight text-xl">
              Event Ghar
            </span>
          </Link>

          {/* Role Status Tag */}
          {userRole === 'admin' && (
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-500/15 text-purple-300 border border-purple-500/30">
              <span className="h-1.5 w-1.5 rounded-full bg-purple-400 animate-pulse" />
              Admin
            </span>
          )}
          {userRole === 'organizer' && (
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Organizer
            </span>
          )}
        </div>

        {/* Right Side Options */}
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Explore Link */}
          <Link
            href="/#events"
            className="rounded-xl px-3 py-2 text-xs sm:text-sm font-semibold text-slate-300 hover:text-white hover:bg-slate-800/70 transition-colors whitespace-nowrap"
          >
            Explore Events
          </Link>

          {/* Request an Event Option */}
          {session ? (
            <Link
              href="/book-event"
              className="hidden sm:inline-flex rounded-xl px-3.5 py-2 text-xs sm:text-sm font-semibold text-slate-200 hover:text-white hover:bg-slate-800/70 transition-colors whitespace-nowrap"
            >
              Request an Event
            </Link>
          ) : (
            <button 
              onClick={handleLoggedOutRequestEvent}
              className="hidden sm:inline-flex rounded-xl px-3.5 py-2 text-xs sm:text-sm font-semibold text-slate-200 hover:text-white hover:bg-slate-800/70 transition-colors whitespace-nowrap cursor-pointer"
            >
              Request an Event
            </button>
          )}

          {/* Manage Bookings Quick Action */}
          {(userRole === 'organizer' || userRole === 'admin') && (
            <Link
              href={userRole === 'admin' ? "/admin/bookings" : "/organizer/bookings"}
              className="rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 px-3.5 py-2 text-xs sm:text-sm font-semibold transition flex items-center gap-1.5 whitespace-nowrap"
            >
              <span>Manage Desk</span>
              <span className="text-xs">→</span>
            </Link>
          )}

          {/* User Profile / Menu Trigger */}
          <div className="relative" ref={userDropdownRef}>
            <button
              type="button"
              onClick={() => setIsUserOpen((prev) => !prev)}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700/80 bg-slate-900 text-white transition hover:border-indigo-500/50 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 cursor-pointer shadow-sm"
              title="Account Options"
              aria-label="Account Options"
            >
              {session?.user?.user_metadata?.avatar_url ? (
                <img
                  src={session.user.user_metadata.avatar_url}
                  alt="Avatar"
                  className="h-8 w-8 rounded-lg object-cover"
                />
              ) : session?.user?.email ? (
                <span className="text-sm font-bold text-indigo-400 uppercase">
                  {session.user.email.charAt(0)}
                </span>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4 text-slate-300"
                >
                  <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              )}
            </button>

            {/* Dropdown Menu */}
            {isUserOpen && (
              <div className="absolute right-0 mt-2.5 w-56 rounded-2xl border border-slate-800 bg-slate-950 p-2 shadow-2xl shadow-black/80 z-50 backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-150">
                {session ? (
                  <>
                    <div className="px-3.5 py-2.5 border-b border-slate-800/80 mb-1.5">
                      <p className="text-xs font-bold text-white truncate">
                        {session.user.user_metadata?.full_name || session.user.email?.split('@')[0]}
                      </p>
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">
                        {session.user.email}
                      </p>
                    </div>

                    {(userRole === 'user' || userRole === 'organizer') && (
                      <Link
                        href="/my-account"
                        onClick={() => setIsUserOpen(false)}
                        className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-slate-900 hover:text-white"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-indigo-400">
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                          <circle cx="12" cy="7" r="4" />
                        </svg>
                        My Account & Tickets
                      </Link>
                    )}

                    {userRole === 'admin' && (
                      <Link
                        href="/admin"
                        onClick={() => setIsUserOpen(false)}
                        className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-purple-300 transition hover:bg-purple-950/40 hover:text-purple-200"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-purple-400">
                          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                        </svg>
                        Admin Control Panel
                      </Link>
                    )}

                    <Link
                      href="/book-event"
                      onClick={() => setIsUserOpen(false)}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-slate-900 hover:text-white"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-pink-400">
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                      Request an Event
                    </Link>

                    <Link
                      href="/contact-us"
                      onClick={() => setIsUserOpen(false)}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-slate-900 hover:text-white"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-emerald-400">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                      </svg>
                      Support & Help
                    </Link>

                    <div className="border-t border-slate-800/80 my-1" />

                    <button
                      onClick={handleSignOut}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-rose-400 transition hover:bg-rose-950/30 hover:text-rose-300 cursor-pointer"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                        <polyline points="16 17 21 12 16 7" />
                        <line x1="21" x2="9" y1="12" y2="12" />
                      </svg>
                      Sign Out
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      href="/login"
                      onClick={() => setIsUserOpen(false)}
                      className="flex w-full items-center justify-center rounded-xl bg-indigo-600 px-3.5 py-2.5 text-xs font-bold text-white transition hover:bg-indigo-500 shadow-md shadow-indigo-600/30"
                    >
                      Log In
                    </Link>
                    <Link
                      href="/signup"
                      onClick={() => setIsUserOpen(false)}
                      className="mt-1 flex w-full items-center justify-center rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-800 hover:text-white"
                    >
                      Create Account
                    </Link>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
