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

    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session) {
        const role = await checkUserRole(data.session.user.id);
        setUserRole(role);
      }
    });
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      if (session) {
        const role = await checkUserRole(session.user.id);
        setUserRole(role);
      } else {
        setUserRole(null);
      }
    });

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      subscription.unsubscribe();
    };
  }, []);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setIsUserOpen(false);
    window.location.href = "/";
  };

  const handleLoggedOutRequestEvent = () => {
    alert("Please log in first to request an event.");
    router.push("/login");
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-surface-border bg-surface text-white backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Left Side: Brand Name */}
        <div className="flex items-center">
          <Link
            href="/"
            className="flex items-center gap-2 text-xl font-bold tracking-tight text-white transition hover:opacity-90"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 text-white shadow-md shadow-indigo-500/20">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
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
            <span className="font-extrabold text-white">
              Event Ghar
            </span>
          </Link>
        </div>

        {/* Right Side Options */}
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Explore Option */}
          <Link
            href="/#events"
            className="rounded-lg px-3 py-2 text-sm font-medium text-white transition hover:bg-neutral-800"
          >
            Explore
          </Link>

          {/* Request an Event Option */}
          {session ? (
            <Link
              href="/book-event"
              className="rounded-lg px-3 py-2 text-sm font-medium text-white transition hover:bg-neutral-800 hidden sm:block"
            >
              Request an Event
            </Link>
          ) : (
            <button 
              onClick={handleLoggedOutRequestEvent}
              className="rounded-lg px-3 py-2 text-sm font-medium text-white transition hover:bg-neutral-800 hidden sm:block"
            >
              Request an Event
            </button>
          )}

          {/* Manage Bookings Option */}
          {(userRole === 'organizer' || userRole === 'admin') && (
            <Link
              href={userRole === 'admin' ? "/admin/bookings" : "/organizer/bookings"}
              className="rounded-lg px-3 py-2 text-sm font-medium text-white transition hover:bg-neutral-800"
            >
              Manage Bookings
            </Link>
          )}

          {/* Person Symbol with Login / Sign Up Dropdown */}
          <div className="relative" ref={userDropdownRef}>
            <button
              type="button"
              onClick={() => {
                setIsUserOpen((prev) => !prev);
              }}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-surface-border bg-surface text-white transition hover:bg-surface-hover focus:outline-none focus:ring-2 focus:ring-purple-600 focus:ring-offset-2"
              title="Account Options"
              aria-label="Account Options"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5"
              >
                <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </button>

            {/* Dropdown Menu */}
            {isUserOpen && (
              <div className="absolute right-0 mt-2 w-48 rounded-xl border border-surface-border bg-surface p-1.5 shadow-lg z-50">
                {session ? (
                  <>
                    <div className="px-3 py-2 text-xs font-semibold text-neutral-500 uppercase tracking-wider border-b border-neutral-800 mb-1">
                      {session.user.user_metadata?.full_name || 'My Account'}
                    </div>
                    {(userRole === 'user' || userRole === 'organizer') && (
                      <Link
                        href="/my-account"
                        onClick={() => setIsUserOpen(false)}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-white transition hover:bg-neutral-800"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                          <circle cx="12" cy="7" r="4" />
                        </svg>
                        My Account
                      </Link>
                    )}
                    {userRole === 'admin' && (
                      <Link
                        href="/admin"
                        onClick={() => setIsUserOpen(false)}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-white transition hover:bg-neutral-800"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                        </svg>
                        Admin Control
                      </Link>
                    )}
                    <button
                      onClick={handleSignOut}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-red-400 transition hover:bg-neutral-800 hover:text-red-300 mt-1"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                        <polyline points="16 17 21 12 16 7" />
                        <line x1="21" x2="9" y1="12" y2="12" />
                      </svg>
                      Log Out
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      href="/login"
                      onClick={() => setIsUserOpen(false)}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-white transition hover:bg-neutral-800"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                        <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                        <polyline points="10 17 15 12 10 7" />
                        <line x1="15" x2="3" y1="12" y2="12" />
                      </svg>
                      Login
                    </Link>
                    <Link
                      href="/signup"
                      onClick={() => setIsUserOpen(false)}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-purple-400 transition hover:bg-neutral-800 hover:text-purple-300 mt-1"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <line x1="19" x2="19" y1="8" y2="14" />
                        <line x1="22" x2="16" y1="11" y2="11" />
                      </svg>
                      Sign Up
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
