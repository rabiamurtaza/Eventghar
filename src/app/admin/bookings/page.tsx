"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { generateTicketsForBooking } from "@/utils/ticketService";
import QRScannerModal from "@/components/QRScannerModal";

export default function AdminBookingsPage() {
  // Main View Switcher
  const [activeMainTab, setActiveMainTab] = useState<"bookings" | "attendance">("bookings");

  // Bookings State
  const [bookings, setBookings] = useState<any[]>([]);
  const [eventsList, setEventsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Bookings Filters
  const [search, setSearch] = useState("");
  const [eventFilter, setEventFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState<"All" | "pending" | "verified" | "rejected">("All");

  // Attendance State
  const [issuedTickets, setIssuedTickets] = useState<any[]>([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceEventFilter, setAttendanceEventFilter] = useState("All");
  const [attendanceStatusFilter, setAttendanceStatusFilter] = useState<"All" | "used" | "valid">("All");
  const [attendanceSearch, setAttendanceSearch] = useState("");

  // Modal preview state
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string; bookingId?: string; currentStatus?: string } | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Scanner Modal state
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  async function fetchBookings() {
    setLoading(true);
    const supabase = createClient();

    const [bookingsRes, eventsRes] = await Promise.all([
      supabase
        .from('bookings')
        .select(`
          *,
          events (
            id,
            title,
            event_number,
            organizer_name,
            organizer_contact,
            organizer_id
          )
        `)
        .order('created_at', { ascending: false }),
      supabase
        .from('events')
        .select('id, title, event_number')
        .order('title', { ascending: true })
    ]);

    if (bookingsRes.data) {
      setBookings(bookingsRes.data);
    }
    if (eventsRes.data) {
      setEventsList(eventsRes.data);
    }
    setLoading(false);
  }

  async function fetchIssuedTickets() {
    setAttendanceLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from('issued_tickets')
      .select(`
        *,
        events (
          id,
          title,
          event_number
        )
      `)
      .order('created_at', { ascending: false });

    if (data) {
      setIssuedTickets(data);
    }
    setAttendanceLoading(false);
  }

  useEffect(() => {
    fetchBookings();
    fetchIssuedTickets();
  }, []);

  const updateStatus = async (id: string, newStatus: string) => {
    setActionLoading(id);
    const supabase = createClient();
    const { error } = await supabase
      .from('bookings')
      .update({ status: newStatus })
      .eq('id', id);

    if (!error) {
      setBookings(prev => prev.map(b => b.id === id ? { ...b, status: newStatus } : b));
      if (previewImage && previewImage.bookingId === id) {
        setPreviewImage(prev => prev ? { ...prev, currentStatus: newStatus } : null);
      }

      // If verified, generate individual issued_tickets automatically!
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
    setActionLoading(null);
  };

  const downloadEventBookingsPDF = () => {
    const doc = new jsPDF();
    doc.text(`Bookings Summary - ${eventFilter} (${statusFilter} Status)`, 14, 15);
    
    const tableData = filteredBookings.map(b => [
      b.events ? `${b.events.event_number ? `#${b.events.event_number} - ` : ''}${b.events.title}` : "Unknown",
      b.full_name || "N/A",
      b.user_email || "N/A",
      b.phone_number || "N/A",
      `${b.ticket_type || 'Standard'} (Qty: ${b.number_of_tickets || 1})`,
      b.status
    ]);

    autoTable(doc, {
      head: [['Event', 'Customer Name', 'Email', 'Phone', 'Tickets', 'Status']],
      body: tableData,
      startY: 22,
    });

    const safeEventName = eventFilter.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    doc.save(`admin_bookings_${safeEventName}.pdf`);
  };

  const downloadVerifiedReceiptsPDF = async () => {
    const doc = new jsPDF();
    const verified = filteredBookings.filter(b => b.status === 'verified' || b.status === 'confirmed');
    
    if (verified.length === 0) {
      alert("No verified receipts found for the selected view.");
      return;
    }

    doc.text(`Verified Receipts - ${eventFilter}`, 14, 15);
    let yPos = 25;

    for (let i = 0; i < verified.length; i++) {
      const b = verified[i];
      if (yPos > 240) {
        doc.addPage();
        yPos = 20;
      }

      doc.setFontSize(11);
      doc.text(`Event: ${b.events?.title || 'Unknown'} (Customer: ${b.full_name} | ${b.phone_number})`, 14, yPos);
      yPos += 6;
      doc.setFontSize(9);
      doc.text(`Tickets: ${b.ticket_type} (x${b.number_of_tickets}) | Email: ${b.user_email}`, 14, yPos);
      yPos += 6;
      
      if (b.payment_screenshot_url) {
        doc.setTextColor(79, 70, 229);
        doc.textWithLink('Direct Link: Payment Receipt', 14, yPos, { url: b.payment_screenshot_url });
        doc.setTextColor(0, 0, 0);
        yPos += 7;
        
        try {
          const img = new Image();
          img.crossOrigin = "Anonymous";
          img.src = b.payment_screenshot_url;
          await new Promise((resolve) => {
             img.onload = () => {
               const width = 90;
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
               doc.text('(Image preview failed to load in PDF)', 14, yPos);
               yPos += 10;
               resolve(null);
             };
          });
        } catch (e) {}
      } else {
        doc.text('No receipt image available.', 14, yPos);
        yPos += 10;
      }
      yPos += 4; 
    }

    const safeEventName = eventFilter.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    doc.save(`verified_receipts_${safeEventName}.pdf`);
  };

  const filteredBookings = bookings.filter(b => {
    const matchesSearch = 
      b.full_name?.toLowerCase().includes(search.toLowerCase()) || 
      b.user_email?.toLowerCase().includes(search.toLowerCase()) ||
      b.events?.title?.toLowerCase().includes(search.toLowerCase()) ||
      b.phone_number?.includes(search);
    const matchesEvent = eventFilter === "All" || b.events?.title === eventFilter;
    const matchesStatus = statusFilter === "All" || 
      (statusFilter === "verified" ? (b.status === "verified" || b.status === "confirmed") : b.status === statusFilter);
    return matchesSearch && matchesEvent && matchesStatus;
  });

  // Attendance filtered list
  const filteredAttendance = issuedTickets.filter(t => {
    const matchesSearch = 
      t.holder_name?.toLowerCase().includes(attendanceSearch.toLowerCase()) ||
      t.holder_email?.toLowerCase().includes(attendanceSearch.toLowerCase()) ||
      t.ticket_code?.toLowerCase().includes(attendanceSearch.toLowerCase()) ||
      t.events?.title?.toLowerCase().includes(attendanceSearch.toLowerCase());
    const matchesEvent = attendanceEventFilter === "All" || t.events?.title === attendanceEventFilter;
    const matchesStatus = attendanceStatusFilter === "All" || t.status === attendanceStatusFilter;
    return matchesSearch && matchesEvent && matchesStatus;
  });

  // Calculate summary counts
  const totalCount = bookings.length;
  const pendingCount = bookings.filter(b => b.status === 'pending').length;
  const verifiedCount = bookings.filter(b => b.status === 'verified' || b.status === 'confirmed').length;
  const rejectedCount = bookings.filter(b => b.status === 'rejected').length;

  // Attendance counts
  const totalTicketsIssued = issuedTickets.length;
  const totalScanned = issuedTickets.filter(t => t.status === 'used').length;
  const totalUnscanned = issuedTickets.filter(t => t.status === 'valid').length;
  const attendanceRate = totalTicketsIssued > 0 ? Math.round((totalScanned / totalTicketsIssued) * 100) : 0;

  return (
    <div className="p-6 sm:p-10">
      
      {/* Header */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-neutral-900 dark:text-white">
            Manage Bookings
          </h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            Verify payment proofs, track gate attendance, and scan participant QR codes.
          </p>
        </div>

        {/* Action Buttons: Scanner & PDF Exports */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsScannerOpen(true)}
            className="rounded-xl bg-indigo-600 hover:bg-indigo-700 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition flex items-center gap-2"
          >
            <span className="text-sm">📷</span>
            <span>QR Scanner</span>
          </button>

          {activeMainTab === "bookings" && (
            <>
              <button 
                onClick={downloadEventBookingsPDF}
                className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-4 py-2.5 text-xs font-semibold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition shadow-sm"
              >
                Download Bookings PDF
              </button>
              <button 
                onClick={downloadVerifiedReceiptsPDF}
                className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-4 py-2.5 text-xs font-semibold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition shadow-sm"
              >
                Verified Receipts PDF
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main Mode Toggle: Bookings vs Gate Attendance */}
      <div className="mb-8 flex border-b border-neutral-200 dark:border-neutral-800">
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
            {totalCount}
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
          <span>🎟️ Gate Attendance & Scanned Tickets</span>
          <span className="rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 text-xs font-bold">
            {totalScanned}/{totalTicketsIssued}
          </span>
        </button>
      </div>

      {/* VIEW 1: BOOKINGS & PAYMENTS */}
      {activeMainTab === "bookings" && (
        <>
          {/* Summary Stat Pills */}
          <div className="mb-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <button
              onClick={() => setStatusFilter("All")}
              className={`p-4 rounded-xl border text-left transition ${
                statusFilter === "All" 
                  ? "bg-indigo-50 border-indigo-200 dark:bg-indigo-900/20 dark:border-indigo-800" 
                  : "bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 hover:border-neutral-300"
              }`}
            >
              <div className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">Total Bookings</div>
              <div className="text-2xl font-black text-neutral-900 dark:text-white mt-1">{totalCount}</div>
            </button>

            <button
              onClick={() => setStatusFilter("pending")}
              className={`p-4 rounded-xl border text-left transition ${
                statusFilter === "pending" 
                  ? "bg-amber-50 border-amber-300 dark:bg-amber-900/30 dark:border-amber-800" 
                  : "bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 hover:border-neutral-300"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">Pending</span>
                {pendingCount > 0 && (
                  <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse"></span>
                )}
              </div>
              <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">{pendingCount}</div>
            </button>

            <button
              onClick={() => setStatusFilter("verified")}
              className={`p-4 rounded-xl border text-left transition ${
                statusFilter === "verified" 
                  ? "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800" 
                  : "bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 hover:border-neutral-300"
              }`}
            >
              <div className="text-xs font-semibold text-green-600 dark:text-green-400">Verified</div>
              <div className="text-2xl font-black text-green-600 dark:text-green-400 mt-1">{verifiedCount}</div>
            </button>

            <button
              onClick={() => setStatusFilter("rejected")}
              className={`p-4 rounded-xl border text-left transition ${
                statusFilter === "rejected" 
                  ? "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800" 
                  : "bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 hover:border-neutral-300"
              }`}
            >
              <div className="text-xs font-semibold text-red-600 dark:text-red-400">Rejected</div>
              <div className="text-2xl font-black text-red-600 dark:text-red-400 mt-1">{rejectedCount}</div>
            </button>
          </div>

          {/* Filter and Search Bar */}
          <div className="mb-6 flex flex-col md:flex-row gap-3">
            <div className="flex-1 relative">
              <input 
                type="text" 
                placeholder="Search by customer name, email, phone, or event..." 
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-indigo-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
              />
              {search && (
                <button 
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-2.5 text-neutral-400 hover:text-neutral-600 text-sm"
                >
                  ✕
                </button>
              )}
            </div>

            <select 
              value={eventFilter}
              onChange={(e) => setEventFilter(e.target.value)}
              className="rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-indigo-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
            >
              <option value="All">All Events</option>
              {eventsList.map((evt) => (
                <option key={evt.id} value={evt.title}>
                  {evt.event_number ? `#${evt.event_number} - ` : ''}{evt.title}
                </option>
              ))}
            </select>

            <select 
              value={statusFilter}
              onChange={(e: any) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-indigo-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
            >
              <option value="All">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="verified">Verified</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          {/* Table Area */}
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden shadow-sm">
            {loading ? (
              <div className="p-12 text-center text-neutral-500">Loading bookings...</div>
            ) : filteredBookings.length === 0 ? (
              <div className="p-12 text-center text-neutral-500">
                No bookings found matching the current filters.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-neutral-600 dark:text-neutral-400">
                  <thead className="border-b border-neutral-200 bg-neutral-50 text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:border-neutral-800 dark:bg-neutral-950/50">
                    <tr>
                      <th className="px-6 py-4">Event</th>
                      <th className="px-6 py-4">Customer Details</th>
                      <th className="px-6 py-4">Tickets</th>
                      <th className="px-6 py-4">Payment Receipt</th>
                      <th className="px-6 py-4">Student ID</th>
                      <th className="px-6 py-4">Status & Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                    {filteredBookings.map((b) => (
                      <tr key={b.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition">
                        
                        {/* Event Column */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1.5 font-bold text-neutral-900 dark:text-white">
                            {b.events?.event_number && (
                              <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/40">
                                #{b.events.event_number}
                              </span>
                            )}
                            <span className="line-clamp-1">{b.events?.title || "Unknown Event"}</span>
                          </div>
                          <div className="text-xs text-neutral-400 mt-1">
                            Host: {b.events?.organizer_name || b.events?.organizer_contact || "N/A"}
                          </div>
                        </td>

                        {/* Customer Column */}
                        <td className="px-6 py-4">
                          <div className="font-semibold text-neutral-900 dark:text-white">{b.full_name || 'N/A'}</div>
                          <div className="text-xs text-neutral-500">{b.user_email}</div>
                          <div className="text-xs text-neutral-400">{b.phone_number || 'No phone'}</div>
                        </td>

                        {/* Ticket Type & Quantity */}
                        <td className="px-6 py-4">
                          <span className="inline-block rounded-md bg-neutral-100 dark:bg-neutral-800 px-2 py-1 text-xs font-medium text-neutral-800 dark:text-neutral-200">
                            {b.ticket_type || 'Standard'}
                          </span>
                          <div className="text-xs text-neutral-500 mt-1">
                            Qty: <strong className="text-neutral-900 dark:text-white">{b.number_of_tickets || 1}</strong>
                          </div>
                        </td>

                        {/* Payment Receipt */}
                        <td className="px-6 py-4">
                          {b.payment_screenshot_url ? (
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setPreviewImage({ 
                                  url: b.payment_screenshot_url, 
                                  title: `Payment Receipt: ${b.full_name}`,
                                  bookingId: b.id,
                                  currentStatus: b.status
                                })}
                                className="group relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-700 hover:border-indigo-500 transition cursor-pointer"
                              >
                                <img 
                                  src={b.payment_screenshot_url} 
                                  alt="Receipt" 
                                  className="h-full w-full object-cover group-hover:scale-105 transition"
                                />
                                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[10px] font-bold transition">
                                  View
                                </div>
                              </button>
                              <a 
                                href={b.payment_screenshot_url} 
                                target="_blank" 
                                rel="noreferrer" 
                                className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                              >
                                Open ↗
                              </a>
                            </div>
                          ) : (
                            <span className="text-xs text-neutral-400">None</span>
                          )}
                        </td>

                        {/* Student ID */}
                        <td className="px-6 py-4">
                          {b.student_id_url ? (
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setPreviewImage({ 
                                  url: b.student_id_url, 
                                  title: `Student ID: ${b.full_name}`,
                                  bookingId: b.id,
                                  currentStatus: b.status
                                })}
                                className="group relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-700 hover:border-indigo-500 transition cursor-pointer"
                              >
                                <img 
                                  src={b.student_id_url} 
                                  alt="Student ID" 
                                  className="h-full w-full object-cover group-hover:scale-105 transition"
                                />
                                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[10px] font-bold transition">
                                  View
                                </div>
                              </button>
                              <a 
                                href={b.student_id_url} 
                                target="_blank" 
                                rel="noreferrer" 
                                className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                              >
                                Open ↗
                              </a>
                            </div>
                          ) : (
                            <span className="text-xs text-neutral-400">N/A</span>
                          )}
                        </td>

                        {/* Status & Action */}
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-2 items-start">
                            {b.status === 'pending' ? (
                              <>
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500"></span>
                                  Pending
                                </span>
                                <div className="flex gap-1.5">
                                  <button 
                                    disabled={actionLoading === b.id}
                                    onClick={() => updateStatus(b.id, 'verified')}
                                    className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-green-700 disabled:opacity-50 transition shadow-sm"
                                  >
                                    {actionLoading === b.id ? "..." : "Verify & Issue QRs"}
                                  </button>
                                  <button 
                                    disabled={actionLoading === b.id}
                                    onClick={() => updateStatus(b.id, 'rejected')}
                                    className="rounded-lg bg-red-100 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50 disabled:opacity-50 transition"
                                  >
                                    {actionLoading === b.id ? "..." : "Reject"}
                                  </button>
                                </div>
                              </>
                            ) : b.status === 'verified' || b.status === 'confirmed' ? (
                              <div className="flex items-center gap-2">
                                <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-green-800 dark:bg-green-900/40 dark:text-green-300">
                                  <span className="h-1.5 w-1.5 rounded-full bg-green-500"></span>
                                  Verified
                                </span>
                                <button 
                                  onClick={() => updateStatus(b.id, 'rejected')}
                                  title="Mark as rejected"
                                  className="text-neutral-400 hover:text-red-500 text-xs transition"
                                >
                                  ✕
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-red-800 dark:bg-red-900/40 dark:text-red-300">
                                  <span className="h-1.5 w-1.5 rounded-full bg-red-500"></span>
                                  Rejected
                                </span>
                                <button 
                                  onClick={() => updateStatus(b.id, 'verified')}
                                  className="text-xs text-green-600 hover:underline font-semibold"
                                >
                                  Re-verify & Issue
                                </button>
                              </div>
                            )}
                          </div>
                        </td>

                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* VIEW 2: GATE ATTENDANCE & SCANNED TICKETS */}
      {activeMainTab === "attendance" && (
        <>
          {/* Attendance Stats Cards */}
          <div className="mb-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl border bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800">
              <div className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">Total Issued Tickets</div>
              <div className="text-2xl font-black text-neutral-900 dark:text-white mt-1">{totalTicketsIssued}</div>
            </div>

            <div className="p-4 rounded-xl border bg-green-50/50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
              <div className="text-xs font-semibold text-green-700 dark:text-green-400">Admitted at Gate (Scanned)</div>
              <div className="text-2xl font-black text-green-700 dark:text-green-400 mt-1">{totalScanned}</div>
            </div>

            <div className="p-4 rounded-xl border bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800">
              <div className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">Remaining (Not Arrived)</div>
              <div className="text-2xl font-black text-neutral-900 dark:text-white mt-1">{totalUnscanned}</div>
            </div>

            <div className="p-4 rounded-xl border bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-800">
              <div className="text-xs font-semibold text-indigo-700 dark:text-indigo-400">Attendance Turnout</div>
              <div className="text-2xl font-black text-indigo-700 dark:text-indigo-400 mt-1">{attendanceRate}%</div>
            </div>
          </div>

          {/* Attendance Filters */}
          <div className="mb-6 flex flex-col md:flex-row gap-3">
            <div className="flex-1 relative">
              <input 
                type="text" 
                placeholder="Search by ticket code (e.g. EG-1001-...), attendee name, email..." 
                value={attendanceSearch}
                onChange={e => setAttendanceSearch(e.target.value)}
                className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-indigo-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
              />
              {attendanceSearch && (
                <button 
                  onClick={() => setAttendanceSearch("")}
                  className="absolute right-3 top-2.5 text-neutral-400 hover:text-neutral-600 text-sm"
                >
                  ✕
                </button>
              )}
            </div>

            <select 
              value={attendanceEventFilter}
              onChange={(e) => setAttendanceEventFilter(e.target.value)}
              className="rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-indigo-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
            >
              <option value="All">All Events</option>
              {eventsList.map((evt) => (
                <option key={evt.id} value={evt.title}>
                  {evt.event_number ? `#${evt.event_number} - ` : ''}{evt.title}
                </option>
              ))}
            </select>

            <select 
              value={attendanceStatusFilter}
              onChange={(e: any) => setAttendanceStatusFilter(e.target.value)}
              className="rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-indigo-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
            >
              <option value="All">All Scan Statuses</option>
              <option value="used">✅ Scanned (Admitted)</option>
              <option value="valid">⏳ Unscanned (Not Arrived)</option>
            </select>
          </div>

          {/* Attendance Table */}
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden shadow-sm">
            {attendanceLoading ? (
              <div className="p-12 text-center text-neutral-500">Loading attendance data...</div>
            ) : filteredAttendance.length === 0 ? (
              <div className="p-12 text-center text-neutral-500">
                No tickets found for this view.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-neutral-600 dark:text-neutral-400">
                  <thead className="border-b border-neutral-200 bg-neutral-50 text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:border-neutral-800 dark:bg-neutral-950/50">
                    <tr>
                      <th className="px-6 py-4">Ticket Code</th>
                      <th className="px-6 py-4">Event</th>
                      <th className="px-6 py-4">Attendee Name</th>
                      <th className="px-6 py-4">Pass Info</th>
                      <th className="px-6 py-4">Gate Status</th>
                      <th className="px-6 py-4">Scanned Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                    {filteredAttendance.map((ticket) => (
                      <tr key={ticket.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition">
                        
                        {/* Ticket Code */}
                        <td className="px-6 py-4">
                          <span className="font-mono text-xs font-bold px-2 py-1 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white border border-neutral-200 dark:border-neutral-700">
                            {ticket.ticket_code}
                          </span>
                        </td>

                        {/* Event */}
                        <td className="px-6 py-4 font-semibold text-neutral-900 dark:text-white">
                          <div className="flex items-center gap-1.5">
                            {ticket.events?.event_number && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                                #{ticket.events.event_number}
                              </span>
                            )}
                            <span className="line-clamp-1">{ticket.events?.title || "Event"}</span>
                          </div>
                        </td>

                        {/* Attendee */}
                        <td className="px-6 py-4">
                          <div className="font-semibold text-neutral-900 dark:text-white">{ticket.holder_name}</div>
                          <div className="text-xs text-neutral-400">{ticket.holder_email}</div>
                        </td>

                        {/* Pass Info */}
                        <td className="px-6 py-4">
                          <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                            Pass {ticket.ticket_number} of {ticket.total_tickets}
                          </span>
                          <div className="text-[11px] text-neutral-500">
                            {ticket.ticket_type}
                          </div>
                        </td>

                        {/* Gate Status */}
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

                        {/* Scanned Time */}
                        <td className="px-6 py-4 text-xs">
                          {ticket.scanned_at ? (
                            <span className="text-neutral-900 dark:text-white font-medium">
                              {new Date(ticket.scanned_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(ticket.scanned_at).toLocaleDateString()}
                            </span>
                          ) : (
                            <span className="text-neutral-400">-</span>
                          )}
                        </td>

                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Lightbox / Modal for Previewing Receipt or Student ID */}
      {previewImage && (
        <div 
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="relative max-h-[90vh] max-w-2xl w-full bg-white dark:bg-neutral-900 rounded-2xl overflow-hidden shadow-2xl border border-neutral-200 dark:border-neutral-800 flex flex-col"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">
              <h3 className="font-bold text-neutral-900 dark:text-white text-base">
                {previewImage.title}
              </h3>
              <button 
                onClick={() => setPreviewImage(null)}
                className="h-8 w-8 rounded-lg flex items-center justify-center text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
              >
                ✕
              </button>
            </div>

            {/* Modal Image Body */}
            <div className="p-4 flex items-center justify-center bg-neutral-100 dark:bg-neutral-950 overflow-auto max-h-[65vh]">
              <img 
                src={previewImage.url} 
                alt="Document Preview" 
                className="max-h-[60vh] max-w-full rounded-lg object-contain shadow-sm"
              />
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
              <a 
                href={previewImage.url} 
                target="_blank" 
                rel="noreferrer"
                className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
              >
                Open Full Resolution in New Tab ↗
              </a>

              {previewImage.bookingId && (
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      updateStatus(previewImage.bookingId!, 'verified');
                      setPreviewImage(null);
                    }}
                    className="rounded-xl bg-green-600 px-4 py-2 text-xs font-bold text-white hover:bg-green-700 transition"
                  >
                    Verify & Issue QRs
                  </button>
                  <button
                    onClick={() => {
                      updateStatus(previewImage.bookingId!, 'rejected');
                      setPreviewImage(null);
                    }}
                    className="rounded-xl bg-red-100 px-4 py-2 text-xs font-bold text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 transition"
                  >
                    Reject Booking
                  </button>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* QR Scanner Modal (with event selector for admin) */}
      <QRScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        isAdmin={true}
        eventsList={eventsList}
        onScanSuccess={() => {
          fetchIssuedTickets();
        }}
      />

    </div>
  );
}
