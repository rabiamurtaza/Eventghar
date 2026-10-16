"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import TicketPassCard from "@/components/TicketPassCard";

export default function MyAccountPage() {
  const [activeTab, setActiveTab] = useState<"profile" | "tickets" | "events">("profile");
  const [loading, setLoading] = useState(true);
  
  // Profile state
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [role, setRole] = useState("user");
  const [accountNumber, setAccountNumber] = useState<number | null>(null);
  const [profileMessage, setProfileMessage] = useState<{ type: "success" | "error", text: string } | null>(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  
  // Tickets state (for normal users)
  const [tickets, setTickets] = useState<any[]>([]);
  const [issuedTicketsMap, setIssuedTicketsMap] = useState<Record<string, any[]>>({});

  // Events state (for organizers)
  const [organizerEvents, setOrganizerEvents] = useState<any[]>([]);
  const [selectedEventModal, setSelectedEventModal] = useState<any | null>(null);
  
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

        // Fetch events hosted by this organizer
        const { data: orgEvents } = await supabase
          .from("events")
          .select("*")
          .eq("organizer_id", session.user.id)
          .order("created_at", { ascending: false });

        if (orgEvents) {
          setOrganizerEvents(orgEvents);
        }
      } else {
        // 3. Otherwise, check User
        const { data: userData } = await supabase
          .from("users")
          .select("*")
          .eq("id", session.user.id)
          .single();
          
        setRole("user");
        const resolvedName = userData?.full_name || session.user.user_metadata?.full_name || session.user.user_metadata?.name || session.user.email?.split('@')[0] || "";
        setFullName(resolvedName);
        setPhoneNumber(userData?.phone_number || "");
        if (!userData?.phone_number) setIsEditingProfile(true);

        if (!userData?.full_name && resolvedName) {
          await supabase.from("users").upsert({
            id: session.user.id,
            email: session.user.email || "",
            full_name: resolvedName,
          }, { onConflict: "id" });
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
      }

      setLoading(false);
    }
    
    loadData();

    // Supabase Realtime Subscription for Instant Updates
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
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "events" },
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
      email: session.user.email,
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
                    ? "border-b-2 border-indigo-500 text-indigo-600 dark:text-indigo-400 font-semibold" 
                    : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                }`}
              >
                Complete Profile
              </button>
              {role === 'organizer' ? (
                <button
                  onClick={() => setActiveTab("events")}
                  className={`pb-4 px-4 text-sm font-medium transition ${
                    activeTab === "events" 
                      ? "border-b-2 border-indigo-500 text-indigo-600 dark:text-indigo-400 font-semibold" 
                      : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                  }`}
                >
                  My Events ({organizerEvents.length})
                </button>
              ) : (
                <button
                  onClick={() => setActiveTab("tickets")}
                  className={`pb-4 px-4 text-sm font-medium transition ${
                    activeTab === "tickets" 
                      ? "border-b-2 border-indigo-500 text-indigo-600 dark:text-indigo-400 font-semibold" 
                      : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                  }`}
                >
                  My Tickets ({tickets.length})
                </button>
              )}
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

            {/* Organizer Hosted Events Content */}
            {role === "organizer" && activeTab === "events" && (
              <div className="bg-white dark:bg-black rounded-xl border border-neutral-200 dark:border-neutral-800 p-6 sm:p-8 shadow-sm">
                <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-neutral-900 dark:text-white">My Hosted Events</h2>
                    <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                      Manage and track events assigned to your organizer account.
                    </p>
                  </div>
                  <button
                    onClick={() => router.push("/organizer/bookings")}
                    className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition"
                  >
                    <span>📋 Manage Bookings & Scanner ➔</span>
                  </button>
                </div>

                {organizerEvents.length === 0 ? (
                  <div className="text-center py-12 border-2 border-dashed border-neutral-200 dark:border-neutral-800 rounded-xl">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 mb-4 text-2xl">
                      🎪
                    </div>
                    <h3 className="text-base font-bold text-neutral-900 dark:text-white mb-1">No Hosted Events Yet</h3>
                    <p className="text-neutral-500 dark:text-neutral-400 text-sm max-w-md mx-auto mb-4">
                      When the administrator creates or assigns an event to your organizer account, it will appear here instantly.
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {organizerEvents.map((evt) => (
                      <div 
                        key={evt.id}
                        onClick={() => setSelectedEventModal(evt)}
                        className="group cursor-pointer border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden bg-white dark:bg-neutral-900 shadow-sm hover:shadow-md hover:border-indigo-500/50 dark:hover:border-indigo-500/50 transition flex flex-col"
                      >
                        <div className="relative aspect-video w-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
                          {evt.image_url ? (
                            <img 
                              src={evt.image_url} 
                              alt={evt.title} 
                              className="h-full w-full object-cover group-hover:scale-105 transition duration-300" 
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-3xl font-black text-neutral-300 dark:text-neutral-700">
                              EVENT
                            </div>
                          )}
                          <span className={`absolute top-3 left-3 text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-sm ${
                            evt.status === 'published' 
                              ? 'bg-green-500 text-white' 
                              : 'bg-amber-500 text-white'
                          }`}>
                            {evt.status || 'Draft'}
                          </span>
                          {evt.event_number && (
                            <span className="absolute top-3 right-3 text-xs font-bold px-2 py-0.5 rounded bg-black/60 backdrop-blur-md text-white border border-white/20">
                              #{evt.event_number}
                            </span>
                          )}
                        </div>

                        <div className="p-5 flex-1 flex flex-col justify-between">
                          <div>
                            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                              {evt.category || "General Event"}
                            </span>
                            <h3 className="mt-1 font-bold text-base text-neutral-900 dark:text-white line-clamp-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">
                              {evt.title}
                            </h3>

                            <div className="mt-3 space-y-1.5 text-xs text-neutral-600 dark:text-neutral-400">
                              <p className="flex items-center gap-2">
                                <span>📅</span>
                                <span>{evt.start_date ? new Date(evt.start_date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : "Date TBD"}</span>
                              </p>
                              <p className="flex items-center gap-2">
                                <span>📍</span>
                                <span className="line-clamp-1">{evt.venue_name ? `${evt.venue_name}${evt.city ? `, ${evt.city}` : ''}` : (evt.location || "Location TBD")}</span>
                              </p>
                            </div>
                          </div>

                          <div className="mt-4 pt-4 border-t border-neutral-100 dark:border-neutral-800 flex gap-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedEventModal(evt);
                              }}
                              className="flex-1 rounded-lg bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 py-2 text-xs font-semibold text-neutral-900 dark:text-white text-center transition"
                            >
                              View Details
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push("/organizer/bookings");
                              }}
                              className="flex-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 py-2 text-xs font-semibold text-white text-center transition"
                            >
                              Bookings
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Event Details Modal */}
            {selectedEventModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 sm:p-8">
                  {selectedEventModal.image_url && (
                    <div className="relative aspect-video w-full rounded-2xl overflow-hidden mb-6 bg-neutral-100 dark:bg-neutral-800">
                      <img src={selectedEventModal.image_url} alt={selectedEventModal.title} className="w-full h-full object-cover" />
                      <span className={`absolute top-3 left-3 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider ${
                        selectedEventModal.status === 'published' ? 'bg-green-500 text-white' : 'bg-amber-500 text-white'
                      }`}>
                        {selectedEventModal.status || 'Draft'}
                      </span>
                      {selectedEventModal.event_number && (
                        <span className="absolute top-3 right-3 text-xs font-bold px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-md text-white">
                          Event #{selectedEventModal.event_number}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                        {selectedEventModal.category || "General Event"}
                      </span>
                      <h2 className="text-2xl font-extrabold text-neutral-900 dark:text-white mt-1">
                        {selectedEventModal.title}
                      </h2>
                    </div>
                    <button
                      onClick={() => setSelectedEventModal(null)}
                      className="text-neutral-400 hover:text-neutral-700 dark:hover:text-white p-1 rounded-lg"
                    >
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm bg-neutral-50 dark:bg-neutral-800/50 p-4 rounded-2xl border border-neutral-100 dark:border-neutral-800">
                    <div>
                      <p className="text-xs font-semibold text-neutral-400 uppercase">Starts</p>
                      <p className="font-bold text-neutral-900 dark:text-white mt-0.5">
                        {selectedEventModal.start_date ? new Date(selectedEventModal.start_date).toLocaleString() : "TBD"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-neutral-400 uppercase">Ends</p>
                      <p className="font-bold text-neutral-900 dark:text-white mt-0.5">
                        {selectedEventModal.end_date ? new Date(selectedEventModal.end_date).toLocaleString() : "TBD"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-neutral-400 uppercase">Venue</p>
                      <p className="font-bold text-neutral-900 dark:text-white mt-0.5">
                        {selectedEventModal.venue_name || selectedEventModal.location || "TBD"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-neutral-400 uppercase">City / Address</p>
                      <p className="font-bold text-neutral-900 dark:text-white mt-0.5">
                        {selectedEventModal.address ? `${selectedEventModal.address}, ` : ''}{selectedEventModal.city || "Pakistan"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-neutral-400 uppercase">Audience Restriction</p>
                      <p className="font-bold text-neutral-900 dark:text-white mt-0.5">
                        {selectedEventModal.is_student_only ? "Students Only (ID Required)" : "Open to Everyone"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-neutral-400 uppercase">Max Tickets Per Person</p>
                      <p className="font-bold text-neutral-900 dark:text-white mt-0.5">
                        {selectedEventModal.max_tickets_per_person || 3}
                      </p>
                    </div>
                  </div>

                  {/* Ticket Tiers */}
                  <div className="mt-6">
                    <h3 className="text-sm font-bold text-neutral-900 dark:text-white mb-2">Ticket Tiers / Pricing</h3>
                    <div>
                      {(() => {
                        let tiers = [];
                        try {
                          if (selectedEventModal.ticket_price) {
                            const parsed = typeof selectedEventModal.ticket_price === 'string' ? JSON.parse(selectedEventModal.ticket_price) : selectedEventModal.ticket_price;
                            if (Array.isArray(parsed)) tiers = parsed;
                          }
                        } catch(e) {}

                        if (tiers.length === 0) {
                          return <p className="text-xs text-neutral-500">Free / Standard pricing</p>;
                        }

                        return (
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {tiers.map((t: any, i: number) => (
                              <div key={i} className="p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
                                <p className="text-xs text-neutral-500 font-medium">{t.name || "Tier"}</p>
                                <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400">Rs. {Number(t.price || 0).toLocaleString()}</p>
                                {t.total && <p className="text-[11px] text-neutral-400">Capacity: {t.total}</p>}
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {selectedEventModal.description && (
                    <div className="mt-6">
                      <h3 className="text-sm font-bold text-neutral-900 dark:text-white mb-1">About This Event</h3>
                      <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed whitespace-pre-line">
                        {selectedEventModal.description}
                      </p>
                    </div>
                  )}

                  <div className="mt-8 pt-4 border-t border-neutral-100 dark:border-neutral-800 flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={() => {
                        setSelectedEventModal(null);
                        router.push("/organizer/bookings");
                      }}
                      className="flex-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 px-6 py-3 text-sm font-bold text-white shadow-sm transition text-center"
                    >
                      Manage Bookings & QR Scanner ➔
                    </button>
                    <button
                      onClick={() => setSelectedEventModal(null)}
                      className="rounded-xl border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 px-6 py-3 text-sm font-semibold text-neutral-700 dark:text-neutral-300 transition"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Tickets Content (Users Only) */}
            {role !== "organizer" && activeTab === "tickets" && (
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
