"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import LiveIndicator from "@/components/LiveIndicator";

interface ContactMessage {
  id: string;
  full_name: string;
  email: string;
  phone_number: string;
  category: string;
  message: string;
  status: "pending" | "resolved" | "in_progress";
  created_at: string;
}

export default function AdminContactMessagesPage() {
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [categoryFilter, setCategoryFilter] = useState<string>("All");
  const [selectedMessage, setSelectedMessage] = useState<ContactMessage | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const supabase = createClient();

  const fetchMessages = async () => {
    try {
      const { data, error } = await supabase
        .from("contact_messages")
        .select("*")
        .order("created_at", { ascending: false });

      if (data) {
        setMessages(data);
      } else if (error) {
        console.warn("Error fetching contact messages:", error.message);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();

    // Realtime subscription for incoming messages
    const channel = supabase
      .channel("contact-messages-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "contact_messages" },
        () => {
          fetchMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleToggleStatus = async (msg: ContactMessage) => {
    setActionLoading(msg.id);
    const newStatus = msg.status === "resolved" ? "pending" : "resolved";
    const { error } = await supabase
      .from("contact_messages")
      .update({ status: newStatus })
      .eq("id", msg.id);

    if (!error) {
      setMessages((prev) =>
        prev.map((m) => (m.id === msg.id ? { ...m, status: newStatus } : m))
      );
      if (selectedMessage?.id === msg.id) {
        setSelectedMessage({ ...selectedMessage, status: newStatus });
      }
    }
    setActionLoading(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this message?")) return;
    setActionLoading(id);
    const { error } = await supabase.from("contact_messages").delete().eq("id", id);
    if (!error) {
      setMessages((prev) => prev.filter((m) => m.id !== id));
      if (selectedMessage?.id === id) setSelectedMessage(null);
    }
    setActionLoading(null);
  };

  // Clean phone number for WhatsApp
  const formatWhatsAppNumber = (phone: string) => {
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.startsWith("0")) {
      return "92" + cleaned.substring(1);
    }
    if (cleaned.startsWith("92")) {
      return cleaned;
    }
    return cleaned;
  };

  // Filtered messages
  const filtered = messages.filter((m) => {
    const matchesSearch =
      m.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      m.email?.toLowerCase().includes(search.toLowerCase()) ||
      m.phone_number?.includes(search) ||
      m.message?.toLowerCase().includes(search.toLowerCase());

    const matchesStatus =
      statusFilter === "All" ? true : m.status === statusFilter;

    const matchesCategory =
      categoryFilter === "All" ? true : m.category === categoryFilter;

    return matchesSearch && matchesStatus && matchesCategory;
  });

  const pendingCount = messages.filter((m) => m.status === "pending").length;
  const resolvedCount = messages.filter((m) => m.status === "resolved").length;

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-neutral-900 dark:text-white">
            Contact & Support Inquiries
          </h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            View, reply, and resolve messages submitted by users through the Contact Us page.
          </p>
        </div>
        <LiveIndicator />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white dark:bg-neutral-900 p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">Total Inquiries</p>
            <p className="text-2xl font-black text-neutral-900 dark:text-white mt-1">{messages.length}</p>
          </div>
          <div className="h-12 w-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xl font-bold">
            ✉️
          </div>
        </div>

        <div className="bg-white dark:bg-neutral-900 p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">Needs Attention</p>
            <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">{pendingCount}</p>
          </div>
          <div className="h-12 w-12 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center text-xl font-bold">
            ⏳
          </div>
        </div>

        <div className="bg-white dark:bg-neutral-900 p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-green-600 dark:text-green-400">Resolved</p>
            <p className="text-2xl font-black text-green-600 dark:text-green-400 mt-1">{resolvedCount}</p>
          </div>
          <div className="h-12 w-12 rounded-xl bg-green-50 dark:bg-green-950/50 text-green-600 dark:text-green-400 flex items-center justify-center text-xl font-bold">
            ✓
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-4 mb-6 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="w-full md:w-80">
          <input
            type="text"
            placeholder="Search by name, email, phone, keyword..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 px-3.5 py-2 text-sm text-neutral-900 dark:text-white outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div className="flex flex-wrap gap-3 w-full md:w-auto">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 px-3 py-2 text-xs font-semibold text-neutral-800 dark:text-neutral-200 outline-none"
          >
            <option value="All">All Categories</option>
            <option value="Payment Verification Issue">Payment Verification</option>
            <option value="Ticket Access & QR Scanner">Ticket & QR Access</option>
            <option value="Event Booking Query">Booking Query</option>
            <option value="Host an Event / Organizer Inquiry">Organizer Inquiry</option>
            <option value="Account / Profile Issue">Account Issue</option>
            <option value="Other Support">Other</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 px-3 py-2 text-xs font-semibold text-neutral-800 dark:text-neutral-200 outline-none"
          >
            <option value="All">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>
      </div>

      {/* Messages Table */}
      {loading ? (
        <div className="p-12 text-center text-neutral-500">Loading inquiries...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white dark:bg-neutral-900 rounded-3xl border-2 border-dashed border-neutral-200 dark:border-neutral-800 p-12 text-center">
          <div className="w-14 h-14 bg-neutral-100 dark:bg-neutral-800 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
            💬
          </div>
          <h3 className="font-bold text-base text-neutral-900 dark:text-white mb-1">
            No contact messages found
          </h3>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            {search || statusFilter !== "All" || categoryFilter !== "All"
              ? "No messages match your selected filters."
              : "Inquiries submitted from the Contact Us page will show up here."}
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-neutral-50 dark:bg-neutral-800/60 border-b border-neutral-200 dark:border-neutral-800 text-[11px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                <tr>
                  <th className="px-6 py-4">Sender</th>
                  <th className="px-6 py-4">Category</th>
                  <th className="px-6 py-4">Message Snippet</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4 text-right">Quick Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {filtered.map((msg) => {
                  const waNumber = formatWhatsAppNumber(msg.phone_number);
                  const waUrl = `https://wa.me/${waNumber}?text=${encodeURIComponent(
                    `Hello ${msg.full_name}, regarding your inquiry on Event Ghar (${msg.category}):\n`
                  )}`;

                  return (
                    <tr
                      key={msg.id}
                      onClick={() => setSelectedMessage(msg)}
                      className="hover:bg-neutral-50/80 dark:hover:bg-neutral-800/40 cursor-pointer transition"
                    >
                      <td className="px-6 py-4">
                        <p className="font-bold text-neutral-900 dark:text-white">{msg.full_name}</p>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400">{msg.email}</p>
                        <p className="text-xs font-mono text-neutral-400 dark:text-neutral-500">{msg.phone_number}</p>
                      </td>

                      <td className="px-6 py-4">
                        <span className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40">
                          {msg.category}
                        </span>
                      </td>

                      <td className="px-6 py-4 max-w-xs">
                        <p className="text-xs text-neutral-600 dark:text-neutral-300 line-clamp-2">
                          {msg.message}
                        </p>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wider ${
                            msg.status === "resolved"
                              ? "bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-400"
                              : "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-400"
                          }`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${msg.status === "resolved" ? "bg-green-500" : "bg-amber-500"}`} />
                          {msg.status}
                        </span>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap text-xs text-neutral-500">
                        {new Date(msg.created_at).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>

                      <td className="px-6 py-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          <a
                            href={waUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Chat on WhatsApp"
                            className="rounded-lg bg-green-50 hover:bg-green-100 dark:bg-green-950/40 dark:hover:bg-green-900/60 text-green-600 dark:text-green-400 px-2.5 py-1.5 text-xs font-bold transition flex items-center gap-1 border border-green-200 dark:border-green-800"
                          >
                            <span>💬</span>
                            <span className="hidden sm:inline">WhatsApp</span>
                          </a>

                          <button
                            type="button"
                            onClick={() => handleToggleStatus(msg)}
                            disabled={actionLoading === msg.id}
                            className={`rounded-lg px-2.5 py-1.5 text-xs font-bold transition ${
                              msg.status === "resolved"
                                ? "bg-neutral-100 hover:bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
                                : "bg-indigo-600 hover:bg-indigo-700 text-white"
                            }`}
                          >
                            {msg.status === "resolved" ? "Re-open" : "Resolve"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Message Details Modal */}
      {selectedMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800 max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 sm:p-8">
            <div className="flex items-start justify-between gap-4 border-b border-neutral-100 dark:border-neutral-800 pb-4 mb-6">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                  {selectedMessage.category}
                </span>
                <h2 className="text-2xl font-bold text-neutral-900 dark:text-white mt-1">
                  Inquiry from {selectedMessage.full_name}
                </h2>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Received on {new Date(selectedMessage.created_at).toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => setSelectedMessage(null)}
                className="text-neutral-400 hover:text-neutral-700 dark:hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            {/* Sender Info Grid */}
            <div className="grid grid-cols-2 gap-4 text-xs bg-neutral-50 dark:bg-neutral-800/50 p-4 rounded-2xl mb-6 border border-neutral-100 dark:border-neutral-800">
              <div>
                <span className="text-neutral-400 font-semibold uppercase block">Sender Name</span>
                <span className="font-bold text-neutral-900 dark:text-white text-sm mt-0.5 block">
                  {selectedMessage.full_name}
                </span>
              </div>
              <div>
                <span className="text-neutral-400 font-semibold uppercase block">Phone Number</span>
                <span className="font-bold text-neutral-900 dark:text-white text-sm mt-0.5 block">
                  {selectedMessage.phone_number}
                </span>
              </div>
              <div className="col-span-2">
                <span className="text-neutral-400 font-semibold uppercase block">Email Address</span>
                <span className="font-bold text-neutral-900 dark:text-white text-sm mt-0.5 block">
                  {selectedMessage.email}
                </span>
              </div>
            </div>

            {/* Message Body */}
            <div className="mb-6">
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2">Message Content</h3>
              <div className="bg-neutral-50 dark:bg-neutral-950 p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 text-sm text-neutral-800 dark:text-neutral-200 whitespace-pre-wrap leading-relaxed">
                {selectedMessage.message}
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-neutral-100 dark:border-neutral-800">
              <a
                href={`https://wa.me/${formatWhatsAppNumber(selectedMessage.phone_number)}?text=${encodeURIComponent(
                  `Hello ${selectedMessage.full_name}, regarding your inquiry on Event Ghar (${selectedMessage.category}):\n`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 rounded-xl bg-green-600 hover:bg-green-700 px-4 py-2.5 text-xs font-bold text-white text-center transition flex items-center justify-center gap-2"
              >
                <span>💬</span>
                <span>Reply on WhatsApp</span>
              </a>

              <a
                href={`mailto:${selectedMessage.email}?subject=${encodeURIComponent(
                  `Re: Event Ghar Support - ${selectedMessage.category}`
                )}`}
                className="flex-1 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 px-4 py-2.5 text-xs font-bold text-neutral-800 dark:text-white text-center transition flex items-center justify-center gap-2"
              >
                <span>✉️</span>
                <span>Reply via Email</span>
              </a>

              <button
                type="button"
                onClick={() => handleToggleStatus(selectedMessage)}
                className={`rounded-xl px-4 py-2.5 text-xs font-bold transition ${
                  selectedMessage.status === "resolved"
                    ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                    : "bg-indigo-600 hover:bg-indigo-700 text-white"
                }`}
              >
                {selectedMessage.status === "resolved" ? "Mark Pending" : "Mark Resolved"}
              </button>

              <button
                type="button"
                onClick={() => handleDelete(selectedMessage.id)}
                className="rounded-xl border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/30 px-3 py-2.5 text-xs font-bold transition"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
