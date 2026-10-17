"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import Link from "next/link";
import LiveIndicator from "@/components/LiveIndicator";

interface Organizer {
  id: string;
  full_name?: string;
  name?: string;
  email: string;
  phone_number?: string;
  organizer_number?: number;
  events?: any[];
}

interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  phone_number?: string;
  user_number?: number;
}

export default function AdminOrganizersAndUsersPage() {
  const [activeTab, setActiveTab] = useState<"organizers" | "users">("organizers");
  const [organizers, setOrganizers] = useState<Organizer[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Manual Add Modal
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [manualId, setManualId] = useState("");
  const [manualName, setManualName] = useState("");
  const [manualEmail, setManualEmail] = useState("");

  const fetchData = async () => {
    setLoading(true);
    const supabase = createClient();

    try {
      // 1. Fetch Organizers
      const { data: orgData } = await supabase
        .from("organizers")
        .select("*");

      // 2. Fetch Users
      const { data: userData } = await supabase
        .from("users")
        .select("*");

      // 3. Fetch Events to map to organizers
      const { data: eventData } = await supabase
        .from("events")
        .select("id, title, organizer_id, organizer_name, organizer_contact, status, event_number")
        .order("created_at", { ascending: false });

      const allEvents = eventData || [];
      setEvents(allEvents);

      // Map events to organizers
      const orgsWithEvents: Organizer[] = (orgData || []).map((org) => {
        const hostedEvents = allEvents.filter(
          (e) => e.organizer_id === org.id || (e.organizer_contact && e.organizer_contact.toLowerCase() === org.email?.toLowerCase())
        );
        return {
          ...org,
          events: hostedEvents,
        };
      });

      setOrganizers(orgsWithEvents);
      setUsers(userData || []);
    } catch (err: any) {
      console.error("Error loading users and organizers:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    const supabase = createClient();
    const channel = supabase
      .channel("admin-organizers-users-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "organizers" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "users" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "events" }, () => fetchData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Promote a User to Organizer
  const handlePromoteToOrganizer = async (userId: string, name: string, email: string, phone?: string) => {
    setActionLoading(userId);
    setMessage(null);
    const supabase = createClient();

    try {
      // 1. Try RPC function if created
      const { data: rpcData, error: rpcError } = await supabase.rpc("promote_user_to_organizer", {
        target_user_id: userId,
        target_name: name,
        target_email: email,
        target_phone: phone || null,
      });

      if (rpcError) {
        // Fallback: direct insert to organizers and delete from users
        const { error: insErr } = await supabase.from("organizers").upsert({
          id: userId,
          full_name: name || "Organizer",
          email: email || "",
          phone_number: phone || null,
        });

        if (insErr) throw insErr;
        await supabase.from("users").delete().eq("id", userId);
      }

      setMessage({
        type: "success",
        text: `Successfully promoted "${name || email}" to Organizer! They can now manage events.`,
      });
      await fetchData();
    } catch (err: any) {
      setMessage({ type: "error", text: "Failed to promote user: " + (err.message || err) });
    } finally {
      setActionLoading(null);
    }
  };

  // Demote an Organizer back to Regular User
  const handleDemoteToUser = async (org: Organizer) => {
    const displayName = org.full_name || org.name || org.email;
    if (org.events && org.events.length > 0) {
      const confirmDemote = window.confirm(
        `Warning: "${displayName}" currently has ${org.events.length} event(s) linked to them. Demoting them will revoke their access to these events. Are you sure?`
      );
      if (!confirmDemote) return;
    } else {
      const confirmDemote = window.confirm(`Are you sure you want to demote "${displayName}" back to a regular user?`);
      if (!confirmDemote) return;
    }

    setActionLoading(org.id);
    setMessage(null);
    const supabase = createClient();

    try {
      // 1. Try RPC function
      const { error: rpcError } = await supabase.rpc("demote_organizer_to_user", {
        target_user_id: org.id,
      });

      if (rpcError) {
        // Fallback: direct insert to users and delete from organizers
        const { error: insErr } = await supabase.from("users").upsert({
          id: org.id,
          full_name: org.full_name || org.name || "User",
          email: org.email || "",
          phone_number: org.phone_number || null,
        });

        if (insErr) throw insErr;
        await supabase.from("organizers").delete().eq("id", org.id);
      }

      setMessage({
        type: "success",
        text: `"${displayName}" has been demoted to a regular User.`,
      });
      await fetchData();
    } catch (err: any) {
      setMessage({ type: "error", text: "Failed to demote organizer: " + (err.message || err) });
    } finally {
      setActionLoading(null);
    }
  };

  // Filtered lists
  const filteredOrganizers = organizers.filter((org) => {
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      org.full_name?.toLowerCase().includes(term) ||
      org.name?.toLowerCase().includes(term) ||
      org.email?.toLowerCase().includes(term) ||
      org.phone_number?.includes(term) ||
      org.id.toLowerCase().includes(term)
    );
  });

  const filteredUsers = users.filter((u) => {
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      u.full_name?.toLowerCase().includes(term) ||
      u.email?.toLowerCase().includes(term) ||
      u.phone_number?.includes(term) ||
      u.id.toLowerCase().includes(term)
    );
  });

  return (
    <div className="p-6 sm:p-10">
      {/* Header */}
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-neutral-900 dark:text-white">Users & Organizers</h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            Manage roles, view registered users, and promote trusted accounts to Event Organizers.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start md:self-auto">
          <LiveIndicator />
          <button
            onClick={() => setIsManualModalOpen(true)}
            className="rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 px-4 py-2.5 text-xs font-bold text-white transition shadow-sm flex items-center gap-2 cursor-pointer"
          >
            <span>+</span> Promote User by UUID
          </button>
        </div>
      </div>

      {/* Notification Toast */}
      {message && (
        <div
          className={`mb-6 p-4 rounded-xl text-sm font-medium flex items-center justify-between ${
            message.type === "success"
              ? "bg-green-50 text-green-800 border border-green-200 dark:bg-green-950/40 dark:text-green-300 dark:border-green-800"
              : "bg-red-50 text-red-800 border border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800"
          }`}
        >
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="text-xs font-bold opacity-70 hover:opacity-100 ml-4">
            ✕
          </button>
        </div>
      )}

      {/* Tabs & Search */}
      <div className="mb-6 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Tab buttons */}
        <div className="flex bg-neutral-200/60 dark:bg-neutral-800 p-1 rounded-xl self-start">
          <button
            onClick={() => setActiveTab("organizers")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === "organizers"
                ? "bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-sm"
                : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
            }`}
          >
            <span>Organizers</span>
            <span className="rounded-full bg-emerald-100 dark:bg-emerald-950/80 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:text-emerald-300">
              {organizers.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("users")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === "users"
                ? "bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-sm"
                : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
            }`}
          >
            <span>Registered Users</span>
            <span className="rounded-full bg-neutral-300 dark:bg-neutral-700 px-2 py-0.5 text-[10px] font-bold text-neutral-700 dark:text-neutral-300">
              {users.length}
            </span>
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full md:w-80">
          <input
            type="text"
            placeholder={activeTab === "organizers" ? "Search organizers by name or email..." : "Search users by name, email, phone..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-4 py-2.5 text-xs text-neutral-900 dark:text-white placeholder:text-neutral-400 outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 text-xs"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Main Content Table */}
      {loading ? (
        <div className="py-20 text-center text-neutral-500">Loading accounts...</div>
      ) : activeTab === "organizers" ? (
        /* Organizers Tab */
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-neutral-600 dark:text-neutral-400">
              <thead className="border-b border-neutral-200 bg-neutral-50 text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:border-neutral-800 dark:bg-neutral-950/50">
                <tr>
                  <th className="px-6 py-4">Organizer</th>
                  <th className="px-6 py-4">Contact</th>
                  <th className="px-6 py-4">Events Assigned</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {filteredOrganizers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-neutral-500">
                      No organizers found. Switch to the <strong>Registered Users</strong> tab to promote a user!
                    </td>
                  </tr>
                ) : (
                  filteredOrganizers.map((org) => (
                    <tr key={org.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition">
                      <td className="px-6 py-4">
                        <div className="font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                          {org.full_name || org.name || "Unnamed"}
                          {org.organizer_number && (
                            <span className="text-[10px] font-mono bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded text-neutral-500">
                              #{org.organizer_number}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] font-mono text-neutral-400 truncate max-w-xs" title={org.id}>
                          ID: {org.id}
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <a href={`mailto:${org.email}`} className="text-indigo-600 dark:text-indigo-400 hover:underline text-xs font-medium block">
                          {org.email || "No email"}
                        </a>
                        {org.phone_number && (
                          <div className="text-xs text-neutral-500 mt-0.5">
                            {org.phone_number}
                          </div>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        {org.events && org.events.length > 0 ? (
                          <div className="flex flex-col gap-1 max-w-md">
                            {org.events.map((evt: any, i: number) => (
                              <div key={i} className="flex items-center gap-2">
                                <Link
                                  href={`/admin/edit-event/${evt.id}`}
                                  className="text-neutral-900 dark:text-neutral-200 font-medium text-xs hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline truncate"
                                >
                                  • {evt.title} {evt.event_number ? `(#${evt.event_number})` : ""}
                                </Link>
                                <span
                                  className={`text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded shrink-0 ${
                                    evt.status === "published"
                                      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                      : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                                  }`}
                                >
                                  {evt.status}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-neutral-400 italic">No events assigned yet</span>
                        )}
                      </td>

                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/admin/create-event?organizer_id=${org.id}&organizer_name=${encodeURIComponent(org.full_name || org.name || "")}&organizer_contact=${encodeURIComponent(org.email || org.phone_number || "")}`}
                            className="rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 px-3 py-1.5 text-xs font-bold transition"
                            title="Create a new event and assign to this organizer"
                          >
                            + Create Event
                          </Link>

                          <button
                            onClick={() => handleDemoteToUser(org)}
                            disabled={actionLoading === org.id}
                            className="rounded-lg border border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 cursor-pointer"
                          >
                            {actionLoading === org.id ? "Demoting..." : "Demote to User"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Registered Users Tab */
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-neutral-600 dark:text-neutral-400">
              <thead className="border-b border-neutral-200 bg-neutral-50 text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:border-neutral-800 dark:bg-neutral-950/50">
                <tr>
                  <th className="px-6 py-4">User</th>
                  <th className="px-6 py-4">Email</th>
                  <th className="px-6 py-4">Phone</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-neutral-500">
                      No registered users found matching your search.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition">
                      <td className="px-6 py-4">
                        <div className="font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                          {user.full_name || "User"}
                          {user.user_number && (
                            <span className="text-[10px] font-mono bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded text-neutral-500">
                              #{user.user_number}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] font-mono text-neutral-400 truncate max-w-xs" title={user.id}>
                          ID: {user.id}
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <span className="text-neutral-700 dark:text-neutral-300 text-xs font-medium">
                          {user.email || "No email"}
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        <span className="text-xs text-neutral-600 dark:text-neutral-400">
                          {user.phone_number || "Not provided"}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handlePromoteToOrganizer(user.id, user.full_name, user.email, user.phone_number)}
                          disabled={actionLoading === user.id}
                          className="rounded-xl bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 text-xs font-bold transition shadow-sm disabled:opacity-50 flex items-center gap-1.5 ml-auto cursor-pointer"
                        >
                          {actionLoading === user.id ? (
                            "Promoting..."
                          ) : (
                            <>
                              <span>★</span>
                              <span>Promote to Organizer</span>
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Manual Promote Modal */}
      {isManualModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-neutral-900 dark:text-white">Promote by User UUID</h3>
              <button
                onClick={() => setIsManualModalOpen(false)}
                className="h-8 w-8 rounded-lg flex items-center justify-center text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-neutral-500">
              Enter the Supabase Auth UUID of the user you want to turn into an organizer.
            </p>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500 mb-1">
                User UUID *
              </label>
              <input
                type="text"
                placeholder="e.g. 4e00f728-5ffd-441e-835c-0dbf4d10e70a"
                value={manualId}
                onChange={(e) => setManualId(e.target.value.trim())}
                className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 px-3 py-2 text-xs font-mono text-neutral-900 dark:text-white outline-none focus:border-indigo-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500 mb-1">
                Organizer Name
              </label>
              <input
                type="text"
                placeholder="e.g. Event Co / Ali Khan"
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 px-3 py-2 text-xs text-neutral-900 dark:text-white outline-none focus:border-indigo-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500 mb-1">
                Organizer Email
              </label>
              <input
                type="email"
                placeholder="e.g. organizer@gmail.com"
                value={manualEmail}
                onChange={(e) => setManualEmail(e.target.value)}
                className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 px-3 py-2 text-xs text-neutral-900 dark:text-white outline-none focus:border-indigo-600"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setIsManualModalOpen(false)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
              >
                Cancel
              </button>

              <button
                onClick={async () => {
                  if (!manualId) return alert("Please enter the User UUID");
                  await handlePromoteToOrganizer(manualId, manualName, manualEmail);
                  setIsManualModalOpen(false);
                  setManualId("");
                  setManualName("");
                  setManualEmail("");
                }}
                disabled={!manualId || actionLoading === manualId}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition disabled:opacity-50"
              >
                Promote to Organizer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
