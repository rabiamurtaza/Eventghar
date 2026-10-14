"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import TicketPassCard from "@/components/TicketPassCard";

export default function MyAccountPage() {
  const [activeTab, setActiveTab] = useState<"profile" | "tickets">("profile");
  const [loading, setLoading] = useState(true);
  
  // Profile state
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [role, setRole] = useState("user");
  const [accountNumber, setAccountNumber] = useState<number | null>(null);
  const [profileMessage, setProfileMessage] = useState<{ type: "success" | "error", text: string } | null>(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  
  // Tickets state
  const [tickets, setTickets] = useState<any[]>([]);
  const [issuedTicketsMap, setIssuedTicketsMap] = useState<Record<string, any[]>>({});
  
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    async function loadData() {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push("/login");
        return;
      }

      setEmail(session.user.email || "");

      // 1. Check if Admin
      const { data: adminData } = await supabase
        .from("admins")
        .select("*")
        .eq("id", session.user.id)
        .single();
        
      if (adminData) {
        setRole("admin");
        setFullName(adminData.full_name || session.user.user_metadata?.full_name || "");
        setLoading(false);
        return; // Admins don't need bookings
      }

      // 2. Check if Organizer
      const { data: organizerData } = await supabase
        .from("organizers")
        .select("*")
        .eq("id", session.user.id)
        .single();

      if (organizerData) {
        setRole("organizer");
        setAccountNumber(organizerData.organizer_number || null);
        setFullName(organizerData.full_name || session.user.user_metadata?.full_name || "");
        setPhoneNumber(organizerData.phone_number || "");
        if (!organizerData.phone_number) setIsEditingProfile(true);
      } else {
        // 3. Otherwise, check User
        const { data: userData } = await supabase
          .from("users")
          .select("*")
          .eq("id", session.user.id)
          .single();
          
        setRole("user");
        setAccountNumber(userData?.user_number || null);
        setFullName(userData?.full_name || session.user.user_metadata?.full_name || "");
        setPhoneNumber(userData?.phone_number || "");
        if (!userData?.phone_number) setIsEditingProfile(true);
      }

      // Fetch user bookings/tickets
      const { data: bookingsData } = await supabase
        .from("bookings")
        .select("*, event:events(*)")
        .eq("user_email", session.user.email)
        .order("created_at", { ascending: false });
        
      if (bookingsData) {
        setTickets(bookingsData);
      }

      // Fetch issued tickets / passes with QR codes
      const { data: issuedData } = await supabase
        .from("issued_tickets")
        .select("*")
        .eq("holder_email", session.user.email)
        .order("ticket_number", { ascending: true });

      if (issuedData) {
        const map: Record<string, any[]> = {};
        issuedData.forEach((pass) => {
          if (!map[pass.booking_id]) map[pass.booking_id] = [];
          map[pass.booking_id].push(pass);
        });
        setIssuedTicketsMap(map);
      }

      setLoading(false);
    }
    
    loadData();

    // Supabase Realtime Subscription for Instant Ticket Updates
    const channel = supabase
      .channel("account-tickets-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bookings" },
        () => {
          loadData();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "issued_tickets" },
        () => {
          loadData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router, supabase]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMessage(null);
    
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    // Validate phone number (exactly 11 digits if provided)
    if (phoneNumber && !/^\d{11}$/.test(phoneNumber)) {
      setProfileMessage({ type: "error", text: "Phone number must be exactly 11 digits." });
      return;
    }

    const updates = {
      id: session.user.id,
      full_name: fullName,
      phone_number: phoneNumber,
    };

    let error;

    if (role === "organizer") {
      // Upsert to organizers, delete from users
      const { error: upsertErr } = await supabase.from("organizers").upsert(updates);
      error = upsertErr;
      if (!error) {
        await supabase.from("users").delete().eq("id", session.user.id);
      }
    } else {
      // Upsert to users, delete from organizers
      const { error: upsertErr } = await supabase.from("users").upsert(updates);
      error = upsertErr;
      if (!error) {
        await supabase.from("organizers").delete().eq("id", session.user.id);
      }
    }

    if (error) {
      setProfileMessage({ type: "error", text: error.message });
    } else {
      setProfileMessage({ type: "success", text: "Profile updated successfully!" });
      setIsEditingProfile(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-950">
        <p className="text-neutral-500">Loading your account...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 py-10">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-neutral-900 dark:text-white mb-8">My Account</h1>
        
        {role === 'admin' ? (
          <div className="bg-white dark:bg-black rounded-xl border border-neutral-200 dark:border-neutral-800 p-8 sm:p-12 shadow-sm text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/30 mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8 text-indigo-600 dark:text-indigo-400">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-neutral-900 dark:text-white mb-2">Administrator Account</h2>
            <p className="text-neutral-500 dark:text-neutral-400 mb-8 max-w-md mx-auto">
              You are logged in as an admin. Regular profile and ticketing features are disabled for administrative accounts.
            </p>
            <button 
              onClick={() => router.push("/admin/create-event")}
              className="rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 transition"
            >
              Go to Admin Dashboard
            </button>
          </div>
        ) : (
          <>
            {/* Tabs */}
            <div className="flex border-b border-neutral-200 dark:border-neutral-800 mb-8">
              <button
                onClick={() => setActiveTab("profile")}
                className={`pb-4 px-4 text-sm font-medium transition ${
                  activeTab === "profile" 
                    ? "border-b-2 border-indigo-500 text-indigo-600 dark:text-indigo-400" 
                    : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                }`}
              >
                Complete Profile
              </button>
              <button
                onClick={() => setActiveTab("tickets")}
                className={`pb-4 px-4 text-sm font-medium transition ${
                  activeTab === "tickets" 
                    ? "border-b-2 border-indigo-500 text-indigo-600 dark:text-indigo-400" 
                    : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                }`}
              >
                My Tickets
              </button>
            </div>

            {/* Profile Content */}
            {activeTab === "profile" && (
              <div className="bg-white dark:bg-black rounded-xl border border-neutral-200 dark:border-neutral-800 p-6 sm:p-8 shadow-sm">
                <h2 className="text-xl font-semibold text-neutral-900 dark:text-white mb-6">Profile Information</h2>
                
                {profileMessage && (
                  <div className={`p-4 mb-6 rounded-lg text-sm ${
                    profileMessage.type === "success" 
                      ? "bg-green-50 text-green-700 dark:bg-green-950/50 dark:text-green-400" 
                      : "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-400"
                  }`}>
                    {profileMessage.text}
                  </div>
                )}

                {isEditingProfile ? (
                  <form onSubmit={handleUpdateProfile} className="space-y-6 max-w-lg">
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Account Type</label>
                      <input 
                        type="text" 
                        disabled 
                        value={role === 'organizer' ? 'Organizer (Host Events)' : 'User (Book Tickets)'}
                        className="mt-1 block w-full rounded-lg border border-neutral-300 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-900 px-3 py-2 text-neutral-500 dark:text-neutral-400 cursor-not-allowed outline-none transition" 
                      />
                      <p className="mt-1 text-xs text-neutral-500">Contact admin to upgrade your account to an Organizer.</p>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Full Name</label>
                      <input 
                        type="text" 
                        required 
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="John Doe" 
                        className="mt-1 block w-full rounded-lg border border-neutral-300 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 px-3 py-2 text-neutral-900 dark:text-white outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition" 
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Phone Number</label>
                      <input 
                        type="tel" 
                        required 
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        placeholder="03XXXXXXXXX" 
                        className="mt-1 block w-full rounded-lg border border-neutral-300 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 px-3 py-2 text-neutral-900 dark:text-white outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition" 
                      />
                    </div>

                    <div className="flex gap-4">
                      <button 
                        type="submit"
                        className="flex-1 sm:flex-none rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 dark:focus:ring-offset-black transition"
                      >
                        Save Profile
                      </button>
                      {phoneNumber && (
                        <button 
                          type="button"
                          onClick={() => setIsEditingProfile(false)}
                          className="flex-1 sm:flex-none rounded-lg bg-neutral-200 dark:bg-neutral-800 px-6 py-2.5 text-sm font-semibold text-neutral-900 dark:text-white shadow-sm hover:bg-neutral-300 dark:hover:bg-neutral-700 focus:outline-none focus:ring-2 focus:ring-neutral-500 focus:ring-offset-2 dark:focus:ring-offset-black transition"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </form>
                ) : (
                  <div className="space-y-6 max-w-lg">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div>
                        <h3 className="text-sm font-medium text-neutral-500 dark:text-neutral-400">Full Name</h3>
                        <p className="mt-1 text-lg font-medium text-neutral-900 dark:text-white">{fullName}</p>
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-neutral-500 dark:text-neutral-400">Email Address</h3>
                        <p className="mt-1 text-lg font-medium text-neutral-900 dark:text-white">{email}</p>
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-neutral-500 dark:text-neutral-400">Phone Number</h3>
                        <p className="mt-1 text-lg font-medium text-neutral-900 dark:text-white">{phoneNumber || "Not provided"}</p>
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-neutral-500 dark:text-neutral-400">Account Type</h3>
                        <span className={`inline-flex mt-1 items-center rounded-full px-2.5 py-0.5 text-sm font-medium capitalize ${
                          role === 'organizer' 
                            ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400' 
                            : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                        }`}>
                          {role}
                        </span>
                      </div>
                      {accountNumber && (
                        <div>
                          <h3 className="text-sm font-medium text-neutral-500 dark:text-neutral-400">Account ID</h3>
                          <p className="mt-1 text-lg font-medium text-neutral-900 dark:text-white">
                            #{accountNumber}
                          </p>
                        </div>
                      )}
                    </div>
                    
                    <div className="pt-4 border-t border-neutral-200 dark:border-neutral-800">
                      <button 
                        onClick={() => setIsEditingProfile(true)}
                        className="rounded-lg bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 px-6 py-2.5 text-sm font-semibold text-neutral-700 dark:text-neutral-300 shadow-sm hover:bg-neutral-50 dark:hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-500 focus:ring-offset-2 dark:focus:ring-offset-black transition"
                      >
                        Edit Profile
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tickets Content */}
            {activeTab === "tickets" && (
              <div className="bg-white dark:bg-black rounded-xl border border-neutral-200 dark:border-neutral-800 p-6 sm:p-8 shadow-sm">
                <h2 className="text-xl font-semibold text-neutral-900 dark:text-white mb-6">My Booked Tickets</h2>
                
                {tickets.length === 0 ? (
                  <div className="text-center py-10 border-2 border-dashed border-neutral-200 dark:border-neutral-800 rounded-xl">
                    <p className="text-neutral-500 dark:text-neutral-400 mb-4">You haven't booked any tickets yet.</p>
                    <button 
                      onClick={() => router.push("/")}
                      className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 transition"
                    >
                      Explore Events
                    </button>
                  </div>
                ) : (
                  <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {tickets.map((ticket) => {
                      const isVerified = ticket.status === 'verified' || ticket.status === 'confirmed';
                      const passes = issuedTicketsMap[ticket.id] || [];

                      if (isVerified) {
                        return (
                          <TicketPassCard
                            key={ticket.id}
                            booking={ticket}
                            passes={passes}
                          />
                        );
                      }

                      return (
                        <div key={ticket.id} className="border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 flex flex-col justify-between bg-white dark:bg-neutral-900 shadow-sm">
                          <div>
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <h3 className="font-bold text-neutral-900 dark:text-white line-clamp-1">
                                {ticket.event?.title || "Event details unavailable"}
                              </h3>
                              {ticket.event?.event_number && (
                                <span className="shrink-0 text-xs font-bold px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700">
                                  #{ticket.event.event_number}
                                </span>
                              )}
                            </div>
                            <div className="mt-3 space-y-2 text-sm text-neutral-600 dark:text-neutral-400">
                              <p className="flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                                  <line x1="16" y1="2" x2="16" y2="6" />
                                  <line x1="8" y1="2" x2="8" y2="6" />
                                  <line x1="3" y1="10" x2="21" y2="10" />
                                </svg>
                                {ticket.event?.start_date ? new Date(ticket.event.start_date).toLocaleDateString() : "TBD"}
                              </p>
                              <p className="flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                  <circle cx="12" cy="10" r="3" />
                                </svg>
                                {ticket.event?.venue_name || "TBD"}
                              </p>
                              <p className="flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                                  <rect width="20" height="14" x="2" y="5" rx="2" />
                                  <line x1="2" x2="22" y1="10" y2="10" />
                                </svg>
                                {ticket.number_of_tickets}x {ticket.ticket_type} Ticket(s)
                              </p>
                            </div>
                            
                            <div className="mt-5 pt-4 border-t border-neutral-200 dark:border-neutral-800">
                              <p className="text-xs text-neutral-500 uppercase tracking-wider font-semibold mb-2">Verification Status</p>
                              <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                                ticket.status === 'rejected'
                                  ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-400 border border-red-200 dark:border-red-800/50'
                                  : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-800/50'
                              }`}>
                                {ticket.status ? ticket.status.charAt(0).toUpperCase() + ticket.status.slice(1) : "Pending"}
                              </span>
                              {ticket.status === 'rejected' ? (
                                <p className="text-xs text-red-500 mt-2">
                                  Your booking was not verified. Please contact support.
                                </p>
                              ) : (
                                <p className="text-xs text-neutral-500 mt-2">
                                  Your payment proof is being verified. QR codes will appear here immediately upon approval.
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
