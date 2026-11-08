"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { verifyBooking, rejectBooking } from "@/utils/bookingActions";
import QRScannerModal from "@/components/QRScannerModal";
import TicketsOverview from "@/components/TicketsOverview";
import { getBookingPrice, formatRs } from "@/utils/bookingPrice";
import { fetchAllRows } from "@/utils/fetchAll";

export default function OrganizerBookingsPage() {
  const [session, setSession] = useState<any>(null);
  const [activeMainTab, setActiveMainTab] = useState<"bookings" | "attendance">("bookings");

  // Bookings State
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  // Holds the selected event's ID ("All" = every event). IDs are unique, titles may not be.
  const [eventFilter, setEventFilter] = useState("All");
  const eventFilterLabel = () => (eventFilter === "All" ? "All" : (eventsList.find(e => e.id === eventFilter)?.title || "Event"));
  const [eventsList, setEventsList] = useState<any[]>([]);

  // Attendance State
  const [issuedTickets, setIssuedTickets] = useState<any[]>([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceSearch, setAttendanceSearch] = useState("");
  const [attendanceStatusFilter, setAttendanceStatusFilter] = useState<"All" | "used" | "valid">("All");

  // Scanner Modal state
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // PDF Download loading and progress states
  const [isDownloadingBookings, setIsDownloadingBookings] = useState(false);
  const [receiptsDownloadProgress, setReceiptsDownloadProgress] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      
      if (!session) {
        setLoading(false);
        return;
      }

      // Bookings and tickets are loaded in pages of 1,000 so long lists are never cut off
      const bookingsQuery = fetchAllRows((from, to) =>
        supabase
          .from('bookings')
          .select(`
            *,
            events!inner(id, title, organizer_id, event_number, ticket_price, ticket_types(name, price))
          `)
          .eq('events.organizer_id', session.user.id)
          .order('created_at', { ascending: false })
          .order('id')
          .range(from, to)
      );

      const eventsQuery = supabase
        .from('events')
        .select('id, title, organizer_id, event_number, total_tickets, ticket_price, ticket_types(name, total_available)')
        .eq('organizer_id', session.user.id)
        .eq('status', 'published');

      const ticketsQuery = fetchAllRows((from, to) =>
        supabase
          .from('issued_tickets')
          .select(`
            *,
            events!inner(id, title, organizer_id, event_number)
          `)
          .eq('events.organizer_id', session.user.id)
          .order('created_at', { ascending: false })
          .order('id')
          .range(from, to)
      );

      const [bookingsRes, eventsRes, ticketsRes] = await Promise.all([bookingsQuery, eventsQuery, ticketsQuery]);

      if (!bookingsRes.error) {
        setBookings(bookingsRes.data);
      }
      if (eventsRes.data) {
        setEventsList(eventsRes.data);
      }
      if (!ticketsRes.error) {
        setIssuedTickets(ticketsRes.data);
      }
      setLoading(false);
    }

    fetchData();

    const supabase = createClient();
    // Realtime subscription for organizer's bookings & gate attendance.
    // Changes that arrive close together (e.g. a busy gate scanning tickets) trigger ONE reload.
    let reloadTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleReload = () => {
      if (reloadTimer) clearTimeout(reloadTimer);
      reloadTimer = setTimeout(() => fetchData(), 1500);
    };
    const channel = supabase
      .channel("organizer-bookings-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bookings" },
        scheduleReload
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "issued_tickets" },
        scheduleReload
      )
      .subscribe();

    return () => {
      if (reloadTimer) clearTimeout(reloadTimer);
      supabase.removeChannel(channel);
    };
  }, []);

  async function fetchIssuedTickets() {
    if (!session) return;
    setAttendanceLoading(true);
    const supabase = createClient();

    const { data, error } = await fetchAllRows((from, to) =>
      supabase
        .from('issued_tickets')
        .select(`
          *,
          events!inner(id, title, organizer_id, event_number)
        `)
        .eq('events.organizer_id', session.user.id)
        .order('created_at', { ascending: false })
        .order('id')
        .range(from, to)
    );
    if (!error) {
      setIssuedTickets(data);
    }
    setAttendanceLoading(false);
  }

  const inFlightRef = useRef<Set<string>>(new Set());
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const updateStatus = async (id: string, newStatus: 'verified' | 'rejected') => {
    // Ignore double-clicks while this booking is already being processed
    if (inFlightRef.current.has(id)) return;
    const booking = bookings.find(b => b.id === id);
    if (!booking) return;

    inFlightRef.current.add(id);
    setActionLoading(id);
    const supabase = createClient();

    const result = newStatus === 'verified'
      ? await verifyBooking(supabase, booking, (msg) => window.confirm(msg))
      : await rejectBooking(supabase, booking);

    if (result.ok) {
      setBookings(prev => prev.map(b => b.id === id ? { ...b, status: newStatus } : b));
      if (result.warning) alert(result.warning);
      fetchIssuedTickets();
    } else {
      alert(result.error);
    }

    inFlightRef.current.delete(id);
    setActionLoading(null);
  };

  const downloadEventBookingsPDF = async () => {
    if (isDownloadingBookings || receiptsDownloadProgress) return;
    setIsDownloadingBookings(true);

    try {
      await new Promise(r => setTimeout(r, 60));
      const doc = new jsPDF();
      doc.text(`Bookings - ${eventFilterLabel()}`, 14, 15);
      
      const tableData = filteredBookings.map(b => [
        b.events?.title || "Unknown",
        b.full_name,
        b.user_email,
        b.phone_number,
        `${b.ticket_type} (Qty: ${b.number_of_tickets})`,
        formatRs(getBookingPrice(b).total),
        b.status
      ]);

      autoTable(doc, {
        head: [['Event', 'Customer Name', 'Email', 'Phone', 'Tickets', 'Total', 'Status']],
        body: tableData,
        startY: 20,
      });

      doc.save(`bookings_${eventFilterLabel().replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`);
    } catch (err) {
      console.error("Failed to generate bookings PDF:", err);
      alert("Failed to generate bookings PDF.");
    } finally {
      setIsDownloadingBookings(false);
    }
  };

  const downloadVerifiedReceiptsPDF = async () => {
    if (receiptsDownloadProgress || isDownloadingBookings) return;
    const verified = filteredBookings.filter(b => b.status === 'verified' || b.status === 'confirmed');
    
    if (verified.length === 0) {
      alert("No verified receipts found for the selected view.");
      return;
    }

    try {
      setReceiptsDownloadProgress(`Downloading 1 of ${verified.length}...`);
      const doc = new jsPDF();
      doc.text(`Verified Receipts - ${eventFilterLabel()}`, 14, 15);
      let yPos = 25;

      for (let i = 0; i < verified.length; i++) {
        setReceiptsDownloadProgress(`Downloading ${i + 1} of ${verified.length}...`);
        await new Promise(r => setTimeout(r, 40));

        const b = verified[i];
        if (yPos > 250) {
          doc.addPage();
          yPos = 20;
        }

        doc.setFontSize(12);
        doc.text(`Customer: ${b.full_name} | Phone: ${b.phone_number}`, 14, yPos);
        yPos += 7;
        doc.setFontSize(10);
        doc.text(`Tickets: ${b.ticket_type} (x${b.number_of_tickets})`, 14, yPos);
        yPos += 7;
        
        if (b.payment_screenshot_url) {
          doc.setTextColor(0, 0, 255);
          doc.textWithLink('Link: Payment Receipt', 14, yPos, { url: b.payment_screenshot_url });
          doc.setTextColor(0, 0, 0);
          yPos += 8;
          
          try {
            const img = new Image();
            img.crossOrigin = "Anonymous";
            img.src = b.payment_screenshot_url;
            await new Promise((resolve) => {
               img.onload = () => {
                 const width = 100;
                 const height = (img.height * width) / img.width;
                 if (yPos + height > 280) {
                   doc.addPage();
                   yPos = 20;
                 }
                 doc.addImage(img, 'JPEG', 14, yPos, width, height);
                 yPos += height + 10;
                 resolve(null);
               };
               img.onerror = () => {
                 doc.text('(Image failed to load in PDF)', 14, yPos);
                 yPos += 10;
                 resolve(null);
               };
            });
          } catch (e) {}
        } else {
          doc.text('No receipt image available.', 14, yPos);
          yPos += 10;
        }
        yPos += 5; 
      }

      doc.save(`verified_receipts_${eventFilterLabel().replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`);
    } catch (err) {
      console.error("Error creating receipts PDF:", err);
      alert("An error occurred while generating receipts PDF.");
    } finally {
      setReceiptsDownloadProgress(null);
    }
  };

  if (loading) return <div className="p-12 text-center text-neutral-500">Loading bookings...</div>;
  if (!session) return <div className="p-12 text-center text-neutral-500">Please log in to view bookings.</div>;

  const filteredBookings = bookings.filter(b => {
    const matchesSearch = b.full_name?.toLowerCase().includes(search.toLowerCase()) || 
      b.user_email?.toLowerCase().includes(search.toLowerCase()) ||
      b.events?.title?.toLowerCase().includes(search.toLowerCase()) ||
      b.phone_number?.includes(search);
    const matchesEvent = eventFilter === "All" || b.event_id === eventFilter;
    return matchesSearch && matchesEvent;
  });

  const filteredAttendance = issuedTickets.filter(t => {
    const matchesSearch = 
      t.holder_name?.toLowerCase().includes(attendanceSearch.toLowerCase()) ||
      t.holder_email?.toLowerCase().includes(attendanceSearch.toLowerCase()) ||
      t.ticket_code?.toLowerCase().includes(attendanceSearch.toLowerCase()) ||
      t.events?.title?.toLowerCase().includes(attendanceSearch.toLowerCase());
    const matchesEvent = eventFilter === "All" || t.event_id === eventFilter;
    const matchesStatus = attendanceStatusFilter === "All" || t.status === attendanceStatusFilter;
    return matchesSearch && matchesEvent && matchesStatus;
  });

  // Target event for fixed scanner if a specific event is chosen
  const activeEventObj = eventsList.find(e => e.id === eventFilter);

  // Attendance metrics
  const totalTicketsIssued = issuedTickets.length;
  const totalScanned = issuedTickets.filter(t => t.status === 'used').length;
  const totalUnscanned = issuedTickets.filter(t => t.status === 'valid').length;

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 px-4 pt-20 sm:pt-28 pb-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        
        {/* Header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-neutral-900 dark:text-white">
              Manage Bookings
            </h1>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              View participant bookings, verify payments, and scan tickets at the gate.
            </p>
          </div>

          <div className="flex flex-wrap gap-3 items-center">
            {/* The Dedicated QR Scanner Button */}
            <button
              onClick={() => setIsScannerOpen(true)}
              className="rounded-xl bg-indigo-600 hover:bg-indigo-700 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition flex items-center gap-2"
            >
              <span className="text-sm">📷</span>
              <span>{activeEventObj ? `Scan: ${activeEventObj.title}` : "QR Scanner"}</span>
            </button>

          </div>
        </div>

        {/* View Switcher: Bookings vs Gate Attendance */}
        <div className="mb-6 flex overflow-x-auto no-scrollbar border-b border-neutral-200 dark:border-neutral-800">
          <button
            onClick={() => setActiveMainTab("bookings")}
            className={`pb-3 px-5 text-sm font-bold border-b-2 transition flex items-center gap-2 shrink-0 whitespace-nowrap ${
              activeMainTab === "bookings"
                ? "border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400"
                : "border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
            }`}
          >
            <span>📋 Bookings & Payment Proofs</span>
            <span className="rounded-full bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 text-xs">
              {bookings.length}
            </span>
          </button>

          <button
            onClick={() => {
              setActiveMainTab("attendance");
              fetchIssuedTickets();
            }}
            className={`pb-3 px-5 text-sm font-bold border-b-2 transition flex items-center gap-2 shrink-0 whitespace-nowrap ${
              activeMainTab === "attendance"
                ? "border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400"
                : "border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
            }`}
          >
            <span>🎟️ Gate Attendance & Scanned Passes</span>
            <span className="rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 text-xs font-bold">
              {totalScanned}/{totalTicketsIssued}
            </span>
          </button>
        </div>

        {/* VIEW 1: BOOKINGS & PAYMENTS */}
        {activeMainTab === "bookings" && (
          <>
            {/* Capacity vs booked tickets for this organizer's own events only */}
            <TicketsOverview events={eventsList} bookings={bookings} title="My Events - Tickets Overview" />

            <div className="mb-6 flex flex-col sm:flex-row gap-4 justify-between">
              <div className="flex flex-col sm:flex-row gap-4">
                <input 
                  type="text" 
                  placeholder="Search by name, email, phone..." 
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full max-w-md rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm outline-none focus:border-indigo-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
                />
                <select 
                  value={eventFilter}
                  onChange={(e) => setEventFilter(e.target.value)}
                  className="w-full sm:w-auto rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm outline-none focus:border-indigo-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
                >
                  <option value="All">All Events</option>
                  {eventsList.map((evt, i) => (
                    <option key={evt.id || i} value={evt.id}>{evt.event_number ? `#${evt.event_number} - ` : ''}{evt.title}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={downloadEventBookingsPDF}
                  disabled={isDownloadingBookings || !!receiptsDownloadProgress}
                  className="rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isDownloadingBookings ? (
                    <>
                      <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-neutral-400 border-t-transparent" />
                      <span>Downloading PDF...</span>
                    </>
                  ) : (
                    <span>Download Bookings PDF</span>
                  )}
                </button>
                <button 
                  onClick={downloadVerifiedReceiptsPDF}
                  disabled={!!receiptsDownloadProgress || isDownloadingBookings}
                  className="rounded-xl bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {receiptsDownloadProgress ? (
                    <>
                      <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      <span>{receiptsDownloadProgress}</span>
                    </>
                  ) : (
                    <span>Download Verified Receipts</span>
                  )}
                </button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
              <table className="w-full text-left text-sm text-neutral-600 dark:text-neutral-400">
                <thead className="border-b border-neutral-200 bg-neutral-50 text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:border-neutral-800 dark:bg-neutral-950/50">
                  <tr>
                    <th className="px-6 py-4">Event</th>
                    <th className="px-6 py-4">Customer</th>
                    <th className="px-6 py-4">Tickets</th>
                    <th className="px-6 py-4">Payment Proof</th>
                    <th className="px-6 py-4">Total</th>
                    <th className="px-6 py-4">Status & Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                  {filteredBookings.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-neutral-500">No bookings found.</td>
                    </tr>
                  ) : (
                    filteredBookings.map((booking) => (
                      <tr key={booking.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition">
                        <td className="px-6 py-4 font-medium text-neutral-900 dark:text-white">
                          <div className="flex items-center gap-1.5">
                            {booking.events?.event_number && (
                              <span className="shrink-0 text-xs font-bold px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700">
                                #{booking.events.event_number}
                              </span>
                            )}
                            <span>{booking.events?.title || "Unknown Event"}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-semibold text-neutral-900 dark:text-white">{booking.full_name}</div>
                          <div className="text-xs text-neutral-500">{booking.user_email}</div>
                          <div className="text-xs text-neutral-400">{booking.phone_number}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-medium text-neutral-900 dark:text-white">{booking.ticket_type}</div>
                          <div className="text-xs text-neutral-500">Qty: <strong>{booking.number_of_tickets}</strong></div>
                        </td>
                        <td className="px-6 py-4">
                          {booking.payment_screenshot_url ? (
                            <a href={booking.payment_screenshot_url} target="_blank" rel="noreferrer" className="text-indigo-600 dark:text-indigo-400 hover:underline text-xs font-bold">
                              View Receipt ↗
                            </a>
                          ) : (
                            <span className="text-xs text-neutral-400">N/A</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {(() => {
                            // Total amount = ticket type price × quantity
                            const price = getBookingPrice(booking);
                            return price.total === null ? (
                              <span className="text-xs text-neutral-400" title="Ticket type not found in this event's current ticket types">—</span>
                            ) : (
                              <div>
                                <div className="text-sm font-black text-neutral-900 dark:text-white">{formatRs(price.total)}</div>
                                <div className="text-[11px] text-neutral-500">{price.quantity} × {formatRs(price.unitPrice)}</div>
                              </div>
                            );
                          })()}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-2 items-start">
                            {booking.status === 'pending' ? (
                              <>
                                <span className="inline-flex rounded-full bg-yellow-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 mb-1">
                                  Pending
                                </span>
                                <div className="flex gap-2">
                                  <button
                                    disabled={actionLoading === booking.id}
                                    onClick={() => updateStatus(booking.id, 'verified')}
                                    className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-green-700 disabled:opacity-50 transition"
                                  >
                                    {actionLoading === booking.id ? "..." : "Verify & Issue"}
                                  </button>
                                  <button
                                    disabled={actionLoading === booking.id}
                                    onClick={() => updateStatus(booking.id, 'rejected')}
                                    className="rounded-lg bg-red-100 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 disabled:opacity-50 transition"
                                  >
                                    Reject
                                  </button>
                                </div>
                              </>
                            ) : booking.status === 'verified' || booking.status === 'confirmed' ? (
                              <span className="inline-flex rounded-full bg-green-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                Verified
                              </span>
                            ) : (
                              <span className="inline-flex rounded-full bg-red-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-700 dark:bg-red-900/30 dark:text-red-400">
                                Rejected
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* VIEW 2: GATE ATTENDANCE & SCANNED TICKETS */}
        {activeMainTab === "attendance" && (
          <>
            {/* Metrics */}
            <div className="mb-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl border bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800">
                <div className="text-xs font-semibold text-neutral-500">Total Issued Tickets</div>
                <div className="text-2xl font-black text-neutral-900 dark:text-white mt-1">{totalTicketsIssued}</div>
              </div>

              <div className="p-4 rounded-xl border bg-green-50/50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
                <div className="text-xs font-semibold text-green-700 dark:text-green-400">Admitted at Gate (Scanned)</div>
                <div className="text-2xl font-black text-green-700 dark:text-green-400 mt-1">{totalScanned}</div>
              </div>

              <div className="p-4 rounded-xl border bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800">
                <div className="text-xs font-semibold text-neutral-500">Remaining (Not Arrived)</div>
                <div className="text-2xl font-black text-neutral-900 dark:text-white mt-1">{totalUnscanned}</div>
              </div>

              <div className="p-4 rounded-xl border bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-800">
                <div className="text-xs font-semibold text-indigo-700 dark:text-indigo-400">Turnout Rate</div>
                <div className="text-2xl font-black text-indigo-700 dark:text-indigo-400 mt-1">
                  {totalTicketsIssued > 0 ? Math.round((totalScanned / totalTicketsIssued) * 100) : 0}%
                </div>
              </div>
            </div>

            {/* Attendance Filters */}
            <div className="mb-6 flex flex-col sm:flex-row gap-3">
              <input 
                type="text" 
                placeholder="Search attendee name, email, or ticket code..." 
                value={attendanceSearch}
                onChange={e => setAttendanceSearch(e.target.value)}
                className="w-full max-w-md rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm outline-none focus:border-indigo-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
              />

              <select 
                value={attendanceStatusFilter}
                onChange={(e: any) => setAttendanceStatusFilter(e.target.value)}
                className="rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm outline-none focus:border-indigo-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
              >
                <option value="All">All Scan Statuses</option>
                <option value="used">✅ Scanned (Admitted)</option>
                <option value="valid">⏳ Unscanned (Not Arrived)</option>
              </select>
            </div>

            {/* Attendance Table */}
            <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
              {attendanceLoading ? (
                <div className="p-12 text-center text-neutral-500">Loading attendance data...</div>
              ) : filteredAttendance.length === 0 ? (
                <div className="p-12 text-center text-neutral-500">No tickets found for this event.</div>
              ) : (
                <table className="w-full text-left text-sm text-neutral-600 dark:text-neutral-400">
                  <thead className="border-b border-neutral-200 bg-neutral-50 text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:border-neutral-800 dark:bg-neutral-950/50">
                    <tr>
                      <th className="px-6 py-4">Ticket Code</th>
                      <th className="px-6 py-4">Event</th>
                      <th className="px-6 py-4">Attendee</th>
                      <th className="px-6 py-4">Pass</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4">Scanned Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                    {filteredAttendance.map((ticket) => (
                      <tr key={ticket.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition">
                        <td className="px-6 py-4">
                          <span className="font-mono text-xs font-bold px-2 py-1 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white border border-neutral-200 dark:border-neutral-700">
                            {ticket.ticket_code}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-semibold text-neutral-900 dark:text-white">
                          {ticket.events?.title || "Event"}
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-semibold text-neutral-900 dark:text-white">{ticket.holder_name}</div>
                          <div className="text-xs text-neutral-400">{ticket.holder_email}</div>
                        </td>
                        <td className="px-6 py-4 text-xs font-medium text-neutral-700 dark:text-neutral-300">
                          Pass {ticket.ticket_number} of {ticket.total_tickets}
                        </td>
                        <td className="px-6 py-4">
                          {ticket.status === 'used' ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 dark:bg-green-900/30 px-2.5 py-0.5 text-xs font-bold text-green-700 dark:text-green-400">
                              ✓ Admitted
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 dark:bg-neutral-800 px-2.5 py-0.5 text-xs font-semibold text-neutral-600 dark:text-neutral-400">
                              ⏳ Not Scanned
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-xs">
                          {ticket.scanned_at ? (
                            <span className="text-neutral-900 dark:text-white font-medium">
                              {new Date(ticket.scanned_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          ) : (
                            <span className="text-neutral-400">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

        {/* QR Scanner Modal pre-locked to organizer's active event */}
        <QRScannerModal
          isOpen={isScannerOpen}
          onClose={() => setIsScannerOpen(false)}
          fixedEventId={activeEventObj?.id}
          fixedEventTitle={activeEventObj?.title}
          eventsList={eventsList}
          onScanSuccess={() => {
            fetchIssuedTickets();
          }}
        />

      </div>
    </div>
  );
}
