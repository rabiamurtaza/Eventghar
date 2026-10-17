"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { useRouter, usePathname } from "next/navigation";

export default function Navbar() {
  const [isUserOpen, setIsUserOpen] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);
  
  const userDropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const isHome = pathname === "/";

  // Track scroll position to transition from floating glass to solid bar
  useEffect(() => {
    function handleScroll() {
      setIsScrolled(window.scrollY > 80);
    }
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Close dropdown on outside click
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
    const msg = encodeURIComponent("Please log in or create an account first to request an event.");
    router.push(`/login?redirect=${encodeURIComponent('/book-event')}&message=${msg}`);
  };

  // Determine whether navbar is transparent glass over hero or solid white
  const isGlass = isHome && !isScrolled;

  return (
    <>
      <header className="fixed top-2.5 sm:top-4 left-0 right-0 z-50 flex justify-center px-2 sm:px-6 pointer-events-none transition-all duration-300 max-w-full">
        <div
          className={`pointer-events-auto w-full max-w-6xl rounded-full px-2.5 sm:px-6 py-1.5 sm:py-2.5 transition-all duration-300 flex items-center justify-between shadow-lg ${
            isGlass
              ? "bg-white/15 backdrop-blur-md border border-white/20 text-white"
              : "bg-white/95 backdrop-blur-md border border-neutral-200/90 text-[#1c1230] shadow-xl"
          }`}
        >
          {/* Left Side: Text-Based Wordmark "EventGhar" */}
          <div className="flex items-center min-w-0 shrink-0">
            <Link
              href="/"
              className="transition hover:opacity-90 font-heading select-none flex items-center"
              aria-label="EventGhar Home"
            >
              <span className="text-[17px] xs:text-xl sm:text-2xl font-black tracking-tight whitespace-nowrap leading-none flex items-center">
                <span className={isGlass ? "text-white" : "text-[#1c1230]"}>Event</span>
                <span className={isGlass ? "text-purple-300" : "text-[#7a1fd1]"}>Ghar</span>
              </span>
            </Link>
          </div>

          {/* Right Side: Navigation & User Controls */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            {/* Explore Option */}
            <Link
              href="/#events"
              className={`rounded-full px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-medium transition whitespace-nowrap ${
                isGlass
                  ? "text-white/90 hover:text-white hover:bg-white/10"
                  : "text-[#1c1230] hover:text-[#7a1fd1] hover:bg-neutral-100"
              }`}
            >
              Explore
            </Link>

            {/* Request an Event Option (White pill over hero -> Purple pill when solid) */}
            {session ? (
              <Link
                href="/book-event"
                className={`rounded-full px-2 xs:px-3 sm:px-4 py-1 sm:py-2 text-[10px] xs:text-xs sm:text-sm font-semibold transition whitespace-nowrap shadow-xs ${
                  isGlass
                    ? "bg-white text-[#1c1230] hover:bg-neutral-100 shadow-white/10"
                    : "bg-[#7a1fd1] text-white hover:bg-[#6114ae] shadow-[#7a1fd1]/20"
                }`}
              >
                Request an Event
              </Link>
            ) : (
              <button 
                onClick={handleLoggedOutRequestEvent}
                className={`rounded-full px-2 xs:px-3 sm:px-4 py-1 sm:py-2 text-[10px] xs:text-xs sm:text-sm font-semibold transition whitespace-nowrap shadow-xs cursor-pointer ${
                  isGlass
                    ? "bg-white text-[#1c1230] hover:bg-neutral-100 shadow-white/10"
                    : "bg-[#7a1fd1] text-white hover:bg-[#6114ae] shadow-[#7a1fd1]/20"
                }`}
              >
                Request an Event
              </button>
            )}

            {/* Manage Bookings Option for Organizers / Admins */}
            {(userRole === 'organizer' || userRole === 'admin') && (
              <Link
                href={userRole === 'admin' ? "/admin/bookings" : "/organizer/bookings"}
                className={`hidden md:inline-block rounded-full px-3 py-1.5 text-xs sm:text-sm font-medium transition ${
                  isGlass
                    ? "text-white/90 hover:text-white hover:bg-white/10"
                    : "text-[#1c1230] hover:text-[#7a1fd1] hover:bg-neutral-100"
                }`}
              >
                Manage Bookings
              </Link>
            )}

            {/* Soft Filled Circle User Icon / Close (X) when menu open */}
            <div className="relative" ref={userDropdownRef}>
              <button
                type="button"
                onClick={() => setIsUserOpen((prev) => !prev)}
                className={`flex h-7 w-7 sm:h-9 sm:w-9 items-center justify-center rounded-full transition focus:outline-none focus:ring-2 focus:ring-[#7a1fd1] cursor-pointer shrink-0 ${
                  isGlass
                    ? "bg-white/20 text-white hover:bg-white/30 backdrop-blur-md border border-white/20"
                    : "bg-neutral-100 text-[#1c1230] hover:bg-neutral-200 border border-neutral-200"
                }`}
                title={isUserOpen ? "Close menu" : "Account Options"}
                aria-label={isUserOpen ? "Close menu" : "Account Options"}
                aria-expanded={isUserOpen}
              >
                {isUserOpen ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-3.5 w-3.5 sm:h-4 sm:w-4"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-3.5 w-3.5 sm:h-4 sm:w-4"
                  >
                    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                )}
              </button>

              {/* Dropdown Menu */}
              {isUserOpen && (
                <div className="absolute right-0 mt-2.5 w-52 rounded-2xl border border-neutral-200 bg-white p-2 shadow-2xl z-50 text-[#1c1230] animate-in fade-in zoom-in-95 duration-150">
                  {session ? (
                    <>
                      <div className="px-3 py-2 text-xs font-semibold text-neutral-400 border-b border-neutral-100 mb-1">
                        {session.user.user_metadata?.full_name || 'My Account'}
                      </div>
                      {(userRole === 'user' || userRole === 'organizer') && (
                        <Link
                          href="/my-account"
                          onClick={() => setIsUserOpen(false)}
                          className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium hover:bg-neutral-50 transition"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-[#6a17b8]">
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
                          className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium hover:bg-neutral-50 transition"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-[#6a17b8]">
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                          </svg>
                          Admin Control
                        </Link>
                      )}
                      <Link
                        href="/book-event"
                        onClick={() => setIsUserOpen(false)}
                        className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium hover:bg-neutral-50 transition"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-[#6a17b8]">
                          <path d="M12 5v14M5 12h14" />
                        </svg>
                        Request an Event
                      </Link>
                      <button
                        onClick={handleSignOut}
                        className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-red-500 hover:bg-red-50 transition mt-1 cursor-pointer"
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
                        className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium hover:bg-neutral-50 transition"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-[#6a17b8]">
                          <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                          <polyline points="10 17 15 12 10 7" />
                          <line x1="15" x2="3" y1="12" y2="12" />
                        </svg>
                        Login
                      </Link>
                      <Link
                        href="/signup"
                        onClick={() => setIsUserOpen(false)}
                        className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-[#7a1fd1] hover:bg-purple-50 transition mt-1"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                          <circle cx="9" cy="7" r="4" />
                          <line x1="19" x2="19" y1="8" y2="14" />
                          <line x1="22" x2="16" y1="11" y2="11" />
                        </svg>
                        Sign Up
                      </Link>
                      <button
                        onClick={() => {
                          setIsUserOpen(false);
                          handleLoggedOutRequestEvent();
                        }}
                        className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium hover:bg-neutral-50 transition text-left mt-1 border-t border-neutral-100 pt-2 cursor-pointer"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-[#6a17b8]">
                          <path d="M12 5v14M5 12h14" />
                        </svg>
                        Request an Event
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Top Spacer only on subpages so content is never obscured by fixed navbar */}
      {!isHome && <div className="h-16 sm:h-24 shrink-0" aria-hidden="true" />}
    </>
  );
}
