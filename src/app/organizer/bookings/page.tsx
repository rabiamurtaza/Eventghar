"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { generateTicketsForBooking } from "@/utils/ticketService";
import QRScannerModal from "@/components/QRScannerModal";

export default function OrganizerBookingsPage() {
  const [session, setSession] = useState<any>(null);
  const [activeMainTab, setActiveMainTab] = useState<"bookings" | "attendance">("bookings");

  // Bookings State
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [eventFilter, setEventFilter] = useState("All");
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

      const query = supabase
        .from('bookings')
        .select(`
          *,
          events!inner(id, title, organizer_id, event_number)
        `)
        .eq('events.organizer_id', session.user.id)
        .order('created_at', { ascending: false });

      const eventsQuery = supabase
        .from('events')
        .select('id, title, organizer_id, event_number')
        .eq('organizer_id', session.user.id)
        .eq('status', 'published');

      const [bookingsRes, eventsRes] = await Promise.all([query, eventsQuery]);
      
      if (bookingsRes.data) {
        setBookings(bookingsRes.data);
      }
      if (eventsRes.data) {
        setEventsList(eventsRes.data);
      }
      setLoading(false);
    }
    
    fetchData();
  }, []);

  async function fetchIssuedTickets() {
    if (!session) return;
    setAttendanceLoading(true);
    const supabase = createClient();

    const query = supabase
      .from('issued_tickets')
      .select(`
        *,
        events!inner(id, title, organizer_id, event_number)
      `)
      .eq('events.organizer_id', session.user.id)
      .order('created_at', { ascending: false });

    const { data } = await query;
    if (data) {
      setIssuedTickets(data);
    }
    setAttendanceLoading(false);
  }

  const updateStatus = async (id: string, newStatus: string) => {
    const supabase = createClient();
    const { error } = await supabase.from('bookings').update({ status: newStatus }).eq('id', id);
    if (!error) {
       setBookings(prev => prev.map(b => b.id === id ? { ...b, status: newStatus } : b));

       // When verified, automatically generate the individual QR tickets!
       if (newStatus === 'verified') {
         const booking = bookings.find(b => b.id === id);
         if (booking) {
           try {
             await generateTicketsForBooking(supabase, booking);
             fetchIssuedTickets();
           } catch (e: any) {
             console.error("Error generating tickets upon verification:", e);
           }
         }
       }
    } else {
       alert("Failed to update status: " + error.message);
    }
  };

  const downloadEventBookingsPDF = async () => {
    if (isDownloadingBookings || receiptsDownloadProgress) return;
    setIsDownloadingBookings(true);

    try {
      await new Promise(r => setTimeout(r, 60));
      const doc = new jsPDF();
      doc.text(`Bookings - ${eventFilter}`, 14, 15);
      
      const tableData = filteredBookings.map(b => [
        b.events?.title || "Unknown",
        b.full_name,
        b.user_email,
        b.phone_number,
        `${b.ticket_type} (Qty: ${b.number_of_tickets})`,
        b.status
      ]);

      autoTable(doc, {
        head: [['Event', 'Customer Name', 'Email', 'Phone', 'Tickets', 'Status']],
        body: tableData,
        startY: 20,
      });

      doc.save(`bookings_${eventFilter.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`);
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
      doc.text(`Verified Receipts - ${eventFilter}`, 14, 15);
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

      doc.save(`verified_receipts_${eventFilter.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`);
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
    const matchesEvent = eventFilter === "All" || b.events?.title === eventFilter;
    return matchesSearch && matchesEvent;
  });

  const filteredAttendance = issuedTickets.filter(t => {
    const matchesSearch = 
      t.holder_name?.toLowerCase().includes(attendanceSearch.toLowerCase()) ||
      t.holder_email?.toLowerCase().includes(attendanceSearch.toLowerCase()) ||
      t.ticket_code?.toLowerCase().includes(attendanceSearch.toLowerCase()) ||
      t.events?.title?.toLowerCase().includes(attendanceSearch.toLowerCase());
    const matchesEvent = eventFilter === "All" || t.events?.title === eventFilter;
    const matchesStatus = attendanceStatusFilter === "All" || t.status === attendanceStatusFilter;
    return matchesSearch && matchesEvent && matchesStatus;
  });

  // Target event for fixed scanner if a specific event is chosen
  const activeEventObj = eventsList.find(e => e.title === eventFilter);

  // Attendance metrics
  const totalTicketsIssued = issuedTickets.length;
  const totalScanned = issuedTickets.filter(t => t.status === 'used').length;
  const totalUnscanned = issuedTickets.filter(t => t.status === 'valid').length;

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 px-4 py-12 sm:px-6 lg:px-8">
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
        <div className="mb-6 flex border-b border-neutral-200 dark:border-neutral-800">
          <button
            onClick={() => setActiveMainTab("bookings")}
            className={`pb-3 px-5 text-sm font-bold border-b-2 transition flex items-center gap-2 ${
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
            className={`pb-3 px-5 text-sm font-bold border-b-2 transition flex items-center gap-2 ${
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
                    <option key={i} value={evt.title}>{evt.event_number ? `#${evt.event_number} - ` : ''}{evt.title}</option>
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

            <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
              <table className="w-full text-left text-sm text-neutral-600 dark:text-neutral-400">
                <thead className="border-b border-neutral-200 bg-neutral-50 text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:border-neutral-800 dark:bg-neutral-950/50">
                  <tr>
                    <th className="px-6 py-4">Event</th>
                    <th className="px-6 py-4">Customer</th>
                    <th className="px-6 py-4">Tickets</th>
                    <th className="px-6 py-4">Payment Proof</th>
                    <th className="px-6 py-4">Student ID</th>
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
                          {booking.student_id_url ? (
                            <a href={booking.student_id_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-xs font-bold">
                              View ID ↗
                            </a>
                          ) : (
                            <span className="text-xs text-neutral-400">None</span>
                          )}
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
                                    onClick={() => updateStatus(booking.id, 'verified')}
                                    className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-green-700 transition"
                                  >
                                    Verify & Issue
                                  </button>
                                  <button 
                                    onClick={() => updateStatus(booking.id, 'rejected')}
                                    className="rounded-lg bg-red-100 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 transition"
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
            <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
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
