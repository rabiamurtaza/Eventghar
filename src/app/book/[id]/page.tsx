"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import Link from "next/link";
import { uuidv7 } from "@/utils/uuid";
import LiveIndicator from "@/components/LiveIndicator";

const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
const ALLOWED_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp'];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

function validateImageFile(file: File, fieldName: string): string | null {
  const ext = file.name.split('.').pop()?.toLowerCase();
  const isTypeValid = ALLOWED_IMAGE_TYPES.includes(file.type) || (ext && ALLOWED_EXTENSIONS.includes(ext));
  
  if (!isTypeValid) {
    return `Wrong format: Please select a valid picture (.png, .jpg, or .jpeg) for your ${fieldName}.`;
  }
  
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return `File too large: ${fieldName} must be smaller than 5MB.`;
  }
  
  return null;
}

export default function BookTicketPage() {
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : (params.id ?? "");
  const router = useRouter();

  const [session, setSession] = useState<any>(null);
  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Form State
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [ticketType, setTicketType] = useState("");
  const [numberOfTickets, setNumberOfTickets] = useState(1);
  const [paymentScreenshot, setPaymentScreenshot] = useState<File | null>(null);
  const [studentIdCard, setStudentIdCard] = useState<File | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [paymentPreview, setPaymentPreview] = useState<string | null>(null);
  const [studentIdPreview, setStudentIdPreview] = useState<string | null>(null);

  const [ticketOptions, setTicketOptions] = useState<any[]>([]);
  const [paymentAccounts, setPaymentAccounts] = useState<any[]>([]);

  useEffect(() => {
    async function init() {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        const msg = encodeURIComponent("Please create an account or log in first to book your tickets.");
        router.push(`/login?redirect=${encodeURIComponent(`/book/${id}`)}&message=${msg}`);
        return;
      }
      setSession(session);

      // Pre-fill user details from users or organizers table or metadata
      let fetchedName = "";
      let fetchedPhone = "";

      const { data: userProfile } = await supabase
        .from('users')
        .select('full_name, phone_number')
        .eq('id', session.user.id)
        .maybeSingle();

      if (userProfile) {
        fetchedName = userProfile.full_name || "";
        fetchedPhone = userProfile.phone_number || "";
      } else {
        const { data: orgProfile } = await supabase
          .from('organizers')
          .select('full_name, phone_number')
          .eq('id', session.user.id)
          .maybeSingle();
        if (orgProfile) {
          fetchedName = orgProfile.full_name || "";
          fetchedPhone = orgProfile.phone_number || "";
        }
      }

      if (!fetchedName) {
        fetchedName = session.user.user_metadata?.full_name || 
                      session.user.user_metadata?.name || 
                      session.user.user_metadata?.display_name || 
                      session.user.email?.split('@')[0] || 
                      "User";
      }

      setFullName(fetchedName);
      if (fetchedPhone) setPhoneNumber(fetchedPhone);

      let query = supabase.from('events').select('*');
      const isNum = !isNaN(Number(id)) && !isNaN(parseInt(id));
      if (isNum) {
        query = query.eq('event_number', parseInt(id));
      } else {
        query = query.eq('id', id);
      }
      const { data: eventData, error } = await query.single();
      
      if (eventData) {
        setEvent(eventData);
        let tiers: any[] = [];
        if (eventData.ticket_price) {
          try {
            const parsed = typeof eventData.ticket_price === 'string' ? JSON.parse(eventData.ticket_price) : eventData.ticket_price;
            if (Array.isArray(parsed) && parsed.length > 0) tiers = parsed;
          } catch(e) {}
        }
        
        // Fallback to ticket_types table if ticket_price was not on events table
        if (tiers.length === 0) {
          const { data: ttData } = await supabase.from('ticket_types').select('*').eq('event_id', eventData.id);
          if (ttData && ttData.length > 0) {
            tiers = ttData.map((t: any) => ({
              name: t.name || 'Standard',
              price: t.price,
              total: t.total_available
            }));
          }
        }

        if (tiers.length > 0) {
          setTicketOptions(tiers);
          setTicketType(tiers[0].name);
        }

        if (eventData.payment_accounts) {
          try {
            const parsed = typeof eventData.payment_accounts === 'string' ? JSON.parse(eventData.payment_accounts) : eventData.payment_accounts;
            if (Array.isArray(parsed)) setPaymentAccounts(parsed);
          } catch(e) {}
        }
      }
      setLoading(false);
    }
    if (id) {
      init();

      const supabase = createClient();
      const channel = supabase
        .channel(`event-page-${id}-realtime`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "events" },
          () => {
            init();
          }
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "ticket_types" },
          () => {
            init();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [id, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg("");
    
    if (!phoneNumber || !/^\d{11}$/.test(phoneNumber.trim())) {
      setErrorMsg("Please provide a valid 11-digit phone number (e.g. 03001234567).");
      setSubmitting(false);
      return;
    }

    if (!paymentScreenshot) {
      setErrorMsg("Payment screenshot is required.");
      setSubmitting(false);
      return;
    }

    const paymentErr = validateImageFile(paymentScreenshot, "Payment Screenshot");
    if (paymentErr) {
      setErrorMsg(paymentErr);
      setSubmitting(false);
      return;
    }

    if ((event?.is_student_only === true || event?.is_student_only === "true") && !studentIdCard) {
      setErrorMsg("Student ID card is required for this student-only event.");
      setSubmitting(false);
      return;
    }

    if (studentIdCard) {
      const studentErr = validateImageFile(studentIdCard, "Student ID Card");
      if (studentErr) {
        setErrorMsg(studentErr);
        setSubmitting(false);
        return;
      }
    }

    const supabase = createClient();

    let paymentScreenshotUrl = "";
    let studentIdUrl = null;

    try {
      // Upload Payment Screenshot
      const pExt = paymentScreenshot.name.split('.').pop();
      const pName = `payment-${Date.now()}-${Math.random().toString(36).substring(2)}.${pExt}`;
      const { error: pError } = await supabase.storage.from('payment-screenshots').upload(pName, paymentScreenshot);
      if (pError) throw pError;
      const { data: pData } = supabase.storage.from('payment-screenshots').getPublicUrl(pName);
      paymentScreenshotUrl = pData.publicUrl;

      // Upload Student ID
      if (studentIdCard) {
        const sExt = studentIdCard.name.split('.').pop();
        const sName = `studentid-${Date.now()}-${Math.random().toString(36).substring(2)}.${sExt}`;
        const { error: sError } = await supabase.storage.from('student-ids').upload(sName, studentIdCard);
        if (sError) throw sError;
        const { data: sData } = supabase.storage.from('student-ids').getPublicUrl(sName);
        studentIdUrl = sData.publicUrl;
      }

      const payload = {
        id: uuidv7(),
        event_id: event?.id || id,
        user_email: session.user.email,
        full_name: fullName.trim(),
        phone_number: phoneNumber.trim(),
        ticket_type: ticketType,
        number_of_tickets: numberOfTickets,
        payment_screenshot_url: paymentScreenshotUrl,
        student_id_url: studentIdUrl,
        status: 'pending'
      };

      const { error: insertError } = await supabase.from('bookings').insert([payload]);
      if (insertError) throw insertError;

      // Ensure user profile has phone_number and full_name saved in users table
      try {
        await supabase.from('users').upsert({
          id: session.user.id,
          email: session.user.email,
          full_name: fullName.trim(),
          phone_number: phoneNumber.trim(),
        }, { onConflict: 'id' });
      } catch (profileErr) {
        console.error("Failed to update users profile with phone number:", profileErr);
      }

      setSuccess(true);
    } catch (err: any) {
      setErrorMsg(err.message || "An error occurred during booking. Make sure the bookings table and storage buckets exist.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 px-4 py-12">
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="flex justify-between items-center">
            <div className="h-8 bg-neutral-200 dark:bg-neutral-800 rounded-lg w-48 animate-pulse" />
            <LiveIndicator />
          </div>
          <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-8 space-y-4 animate-pulse">
            <div className="h-6 bg-neutral-200 dark:bg-neutral-800 rounded w-1/3" />
            <div className="h-10 bg-neutral-100 dark:bg-neutral-800/50 rounded-xl" />
            <div className="h-10 bg-neutral-100 dark:bg-neutral-800/50 rounded-xl" />
            <div className="h-10 bg-neutral-100 dark:bg-neutral-800/50 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }
  
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-950 px-4">
        <div className="max-w-md w-full bg-white dark:bg-neutral-900 rounded-2xl p-8 text-center shadow-lg border border-neutral-200 dark:border-neutral-800">
          <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
          </div>
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-white mb-4">Thank you for your booking request!</h2>
          <p className="text-neutral-600 dark:text-neutral-400 mb-6">
            Your payment is currently being processed. Once confirmed, you will receive an email containing your ticket's QR code. You will also be able to access your QR code anytime directly from the &quot;My Tickets&quot; page.
          </p>
          <Link href="/" className="inline-block w-full rounded-xl bg-green-500 px-6 py-3 font-bold text-white transition hover:bg-green-600 shadow-lg shadow-green-500/30">
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  // Determine selected ticket price
  const selectedTicket = ticketOptions.find(t => t.name === ticketType);
  const pricePerTicket = selectedTicket ? parseInt(selectedTicket.price || '0') : 0;
  const totalPrice = isNaN(pricePerTicket) ? 0 : pricePerTicket * numberOfTickets;
  const maxAllowedTickets = (event?.is_student_only === true || event?.is_student_only === 'true')
    ? 1 
    : Math.min(3, Math.max(1, Number(event?.max_tickets_per_person) || 3));

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 px-4 py-8 sm:py-12 sm:px-6 lg:px-8">
      {/* Breadcrumb & Navigation */}
      <div className="mx-auto max-w-5xl mb-6 flex items-center justify-between">
        <Link 
          href="/" 
          className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-neutral-600 dark:text-neutral-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition"
        >
          <span>←</span> Back to Events Catalog
        </Link>
        <div className="flex items-center gap-2">
          <LiveIndicator label="Live Availability" />
        </div>
      </div>

      <div className="mx-auto max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column: Event Context & Payment Instructions (5 cols on lg) */}
        <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-24">
          
          {/* Event Snapshot Card */}
          <div className="overflow-hidden rounded-3xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm transition hover:shadow-md">
            {event?.image_url && (
              <div className="relative h-48 w-full overflow-hidden bg-neutral-900">
                <img 
                  src={event.image_url} 
                  alt={event?.title || "Event Poster"} 
                  className="w-full h-full object-cover transition-transform duration-500 hover:scale-105" 
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                {event?.category && (
                  <span className="absolute top-3 left-3 rounded-full bg-black/60 backdrop-blur-md px-3 py-1 text-xs font-bold text-white border border-white/20">
                    {event.category}
                  </span>
                )}
                {event?.event_number && (
                  <span className="absolute top-3 right-3 rounded-full bg-emerald-500/90 backdrop-blur-md px-2.5 py-1 text-xs font-black text-white shadow-sm">
                    #{event.event_number}
                  </span>
                )}
                <div className="absolute bottom-3 left-3 right-3 text-white">
                  <h3 className="text-lg font-black tracking-tight line-clamp-1">{event?.title}</h3>
                  <p className="text-xs text-neutral-300 flex items-center gap-1.5 mt-0.5">
                    <span>📍</span> {event?.venue_name || "Venue TBD"} • {event?.city || ""}
                  </p>
                </div>
              </div>
            )}

            <div className="p-5 sm:p-6 space-y-4">
              {!event?.image_url && (
                <div className="flex items-center justify-between gap-2 border-b border-neutral-100 dark:border-neutral-800 pb-3">
                  <h2 className="text-xl font-bold text-neutral-900 dark:text-white">{event?.title}</h2>
                  {event?.event_number && (
                    <span className="rounded-md bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                      #{event.event_number}
                    </span>
                  )}
                </div>
              )}

              {/* Event Timing & Venue Meta Pills */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-xl border border-neutral-200/70 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-950/70 p-3">
                  <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider block mb-0.5">Event Date</span>
                  <p className="font-semibold text-neutral-900 dark:text-neutral-100">{event?.start_date || "TBD"}</p>
                </div>
                <div className="rounded-xl border border-neutral-200/70 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-950/70 p-3">
                  <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider block mb-0.5">Timing</span>
                  <p className="font-semibold text-neutral-900 dark:text-neutral-100">
                    {event?.start_time || "Doors Open"} {event?.doors_open_time ? `(${event.doors_open_time})` : ""}
                  </p>
                </div>
              </div>

              {event?.is_student_only && (
                <div className="flex items-center gap-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50 p-3 text-xs text-blue-900 dark:text-blue-300">
                  <span className="text-base">🎓</span>
                  <div>
                    <p className="font-bold">Student-Only Event</p>
                    <p className="text-[11px] text-blue-700 dark:text-blue-400 mt-0.5">
                      {event?.university_name ? `Limited to ${event.university_name} students.` : "Valid university student ID required at gate."}
                    </p>
                  </div>
                </div>
              )}

              {event?.description && (
                <div className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed border-t border-neutral-100 dark:border-neutral-800 pt-3">
                  <p className="line-clamp-3">{event.description}</p>
                </div>
              )}
            </div>
          </div>

          {/* Payment Accounts Card with 1-Click Copy */}
          <div className="rounded-3xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5 sm:p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                  <span>💳</span> Payment Instructions
                </h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                  Transfer exact amount to any verified account below
                </p>
              </div>
            </div>

            {event?.payment_instructions && (
              <div className="mb-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 p-3 text-xs text-amber-900 dark:text-amber-300 leading-relaxed">
                <span className="font-bold block mb-0.5">Note from Organizer:</span>
                {event.payment_instructions}
              </div>
            )}

            <div className="space-y-2.5">
              {paymentAccounts.length > 0 ? (
                paymentAccounts.map((acc, i) => {
                  const isCopied = copiedIndex === i;
                  return (
                    <div 
                      key={i} 
                      className="group relative flex items-center justify-between p-3.5 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/80 dark:bg-neutral-950/80 hover:border-emerald-500/50 dark:hover:border-emerald-500/40 transition"
                    >
                      <div className="min-w-0 flex-1 pr-3">
                        <div className="flex items-center gap-2">
                          <span className="inline-block rounded-md bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 font-black text-[10px] tracking-wider uppercase px-2 py-0.5">
                            {acc.method || "Transfer"}
                          </span>
                        </div>
                        <p className="mt-1 font-mono text-sm font-bold text-neutral-900 dark:text-white tracking-wide truncate">
                          {acc.account_title_number}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => copyToClipboard(acc.account_title_number, i)}
                        className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-xs ${
                          isCopied
                            ? "bg-emerald-500 text-white"
                            : "bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-700"
                        }`}
                        title="Copy account number"
                      >
                        {isCopied ? (
                          <>
                            <span>✓</span> Copied!
                          </>
                        ) : (
                          <>
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                            </svg>
                            Copy
                          </>
                        )}
                      </button>
                    </div>
                  );
                })
              ) : (
                <div className="p-4 rounded-xl border border-dashed border-neutral-300 dark:border-neutral-800 text-center text-xs text-neutral-500">
                  Payment account details will be verified by the organizer.
                </div>
              )}
            </div>

            {/* Buyer Protection Guarantee */}
            <div className="mt-4 pt-4 border-t border-neutral-100 dark:border-neutral-800 flex items-center gap-2.5 text-[11px] text-neutral-500 dark:text-neutral-400">
              <span className="text-emerald-500 font-bold">🔒</span>
              <span>Encrypted checkout. Your booking receipt is tied directly to your user account.</span>
            </div>
          </div>

        </div>

        {/* Right Column: Checkout & Booking Form (7 cols on lg) */}
        <div className="lg:col-span-7">
          <div className="rounded-3xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 sm:p-8 shadow-sm">
            
            <div className="flex items-center justify-between pb-5 border-b border-neutral-100 dark:border-neutral-800 mb-6">
              <div>
                <h2 className="text-2xl font-black tracking-tight text-neutral-900 dark:text-white">
                  Confirm Ticket & Checkout
                </h2>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                  Complete your attendee details and upload proof of payment
                </p>
              </div>
              <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                Step 1 of 1
              </span>
            </div>

            {errorMsg && (
              <div className="mb-6 p-4 rounded-2xl bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/40 dark:border-red-900/50 dark:text-red-300 text-xs sm:text-sm font-semibold flex items-start gap-3">
                <span className="text-lg">⚠️</span>
                <div className="flex-1">{errorMsg}</div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              
              {/* Account / Attendee Pill */}
              <div className="p-4 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-950/70">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                    Verified Ticket Holder
                  </span>
                  <Link 
                    href="/my-account" 
                    target="_blank" 
                    className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
                  >
                    Edit in Account ↗
                  </Link>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-white font-black text-base shadow-sm">
                    {fullName ? fullName.charAt(0).toUpperCase() : "U"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-neutral-900 dark:text-white truncate">
                      {fullName || session?.user?.email?.split('@')[0] || "User"}
                    </p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate font-mono">
                      {session?.user?.email}
                    </p>
                  </div>
                </div>
              </div>

              {/* Phone Number Field */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-1.5">
                  Phone Number for Ticket Delivery *
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 font-mono text-sm">
                    🇵🇰
                  </span>
                  <input 
                    type="tel" 
                    required 
                    value={phoneNumber} 
                    onChange={e => setPhoneNumber(e.target.value)} 
                    placeholder="03001234567" 
                    className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 pl-11 pr-4 py-2.5 text-sm font-medium text-neutral-900 dark:text-white outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition" 
                  />
                </div>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1">
                  11 digits without hyphens. We send gate status updates and approval alerts here.
                </p>
              </div>

              {/* Ticket Tier Interactive Cards */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
                    Select Ticket Tier *
                  </label>
                  <span className="text-[11px] text-neutral-400">
                    {ticketOptions.length} tier{ticketOptions.length > 1 ? 's' : ''} available
                  </span>
                </div>

                {ticketOptions.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {ticketOptions.map((t, idx) => {
                      const isSelected = ticketType === t.name;
                      const priceVal = parseInt(t.price || '0');
                      return (
                        <div
                          key={idx}
                          onClick={() => setTicketType(t.name)}
                          className={`cursor-pointer rounded-2xl border p-4 transition relative flex flex-col justify-between ${
                            isSelected
                              ? "border-emerald-500 bg-emerald-50/30 dark:bg-emerald-950/20 ring-2 ring-emerald-500/30 shadow-xs"
                              : "border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/50 hover:border-neutral-300 dark:hover:border-neutral-700"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-bold text-neutral-900 dark:text-white capitalize">
                                {t.name}
                              </p>
                              {t.total && (
                                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                                  {t.total} total capacity
                                </p>
                              )}
                            </div>
                            <div className={`h-5 w-5 rounded-full border flex items-center justify-center ${
                              isSelected
                                ? "border-emerald-500 bg-emerald-500 text-white"
                                : "border-neutral-300 dark:border-neutral-700"
                            }`}>
                              {isSelected && <span className="text-[10px] font-black">✓</span>}
                            </div>
                          </div>

                          <div className="mt-3 pt-2 border-t border-neutral-200/50 dark:border-neutral-800/80">
                            <span className="text-base font-black text-emerald-600 dark:text-emerald-400">
                              Rs. {isNaN(priceVal) ? "0" : priceVal.toLocaleString()}
                            </span>
                            <span className="text-[10px] text-neutral-400 ml-1 font-medium">/ ticket</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-neutral-900 dark:text-white">General Admission</p>
                      <p className="text-xs text-neutral-500">Free Entry</p>
                    </div>
                    <span className="font-bold text-emerald-600 text-sm">Rs. 0</span>
                  </div>
                )}
              </div>

              {/* Number of Tickets Selection */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
                    Number of Tickets *
                  </label>
                  <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                    {(event?.is_student_only === true || event?.is_student_only === 'true')
                      ? "Student Event (Limit 1)" 
                      : `Max ${maxAllowedTickets} tickets`}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  {/* Discrete Quick Select Pills */}
                  <div className="flex items-center gap-2">
                    {Array.from({ length: maxAllowedTickets }, (_, i) => i + 1).map((qty) => {
                      const isSelected = numberOfTickets === qty;
                      return (
                        <button
                          key={qty}
                          type="button"
                          onClick={() => setNumberOfTickets(qty)}
                          className={`h-11 px-4 rounded-xl text-sm font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs ${
                            isSelected
                              ? "bg-emerald-600 text-white shadow-emerald-600/30 ring-2 ring-emerald-500/50 scale-[1.02]"
                              : "bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 border border-neutral-300 dark:border-neutral-700 hover:border-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400"
                          }`}
                        >
                          <span className="text-base">{qty}</span>
                          <span className="text-xs font-normal opacity-90">{qty === 1 ? "Ticket" : "Tickets"}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Dual Stepper with Editable Numeric Input */}
                  <div className="flex items-center rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 overflow-hidden h-11 ml-auto sm:ml-0">
                    <button
                      type="button"
                      aria-label="Decrease tickets"
                      disabled={numberOfTickets <= 1}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setNumberOfTickets((prev) => Math.max(1, prev - 1));
                      }}
                      className="w-10 h-full flex items-center justify-center text-lg font-bold text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-800 transition disabled:opacity-25 cursor-pointer"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min={1}
                      max={maxAllowedTickets}
                      value={numberOfTickets}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (!isNaN(val)) {
                          setNumberOfTickets(Math.min(maxAllowedTickets, Math.max(1, val)));
                        }
                      }}
                      className="w-12 text-center text-sm font-bold text-neutral-900 dark:text-white bg-transparent border-0 focus:ring-0 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <button
                      type="button"
                      aria-label="Increase tickets"
                      disabled={numberOfTickets >= maxAllowedTickets}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setNumberOfTickets((prev) => Math.min(maxAllowedTickets, prev + 1));
                      }}
                      className="w-10 h-full flex items-center justify-center text-lg font-bold text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-800 transition disabled:opacity-25 cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>

                <p className="mt-2 text-[11px] text-neutral-500 dark:text-neutral-400">
                  {(event?.is_student_only === true || event?.is_student_only === 'true')
                    ? "Limited to 1 ticket per student account as required by event rules."
                    : "Select 1, 2, or 3 tickets. Each attendee ticket will receive its own verified QR code."}
                </p>
              </div>

              {/* Order Cost Breakdown Box */}
              <div className="p-4 rounded-2xl bg-neutral-50/80 dark:bg-neutral-950/80 border border-neutral-200/80 dark:border-neutral-800 space-y-2 text-xs">
                <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
                  <span>{ticketType || "Standard"} Ticket × {numberOfTickets}</span>
                  <span className="font-semibold text-neutral-900 dark:text-white">
                    Rs. {(pricePerTicket * numberOfTickets).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
                  <span>Service & Convenience Fee</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">FREE</span>
                </div>
                <div className="pt-2 border-t border-neutral-200 dark:border-neutral-800 flex justify-between items-center text-sm">
                  <span className="font-bold text-neutral-900 dark:text-white">Total Amount to Pay:</span>
                  <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                    Rs. {totalPrice.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Upload Payment Screenshot Dropzone */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-1.5">
                  Upload Payment Screenshot * <span className="font-normal text-neutral-400">(.png, .jpg, .jpeg under 5MB)</span>
                </label>
                <div className="relative rounded-2xl border-2 border-dashed border-neutral-300 dark:border-neutral-700 hover:border-emerald-500/60 dark:hover:border-emerald-500/60 p-5 bg-neutral-50/50 dark:bg-neutral-950/50 transition">
                  {paymentPreview ? (
                    <div className="flex items-center gap-4">
                      <img src={paymentPreview} alt="Screenshot Preview" className="h-20 w-20 object-cover rounded-xl border border-neutral-200 dark:border-neutral-700 shadow-xs" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-neutral-900 dark:text-white truncate">
                          {paymentScreenshot?.name}
                        </p>
                        <p className="text-[11px] text-neutral-500 mt-0.5">
                          {paymentScreenshot ? (paymentScreenshot.size / 1024).toFixed(1) + " KB" : ""}
                        </p>
                        <label className="mt-2 inline-block cursor-pointer text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline">
                          Replace screenshot
                          <input 
                            type="file" 
                            accept="image/png, image/jpeg, image/jpg, image/webp" 
                            className="hidden"
                            onChange={e => {
                              const file = e.target.files?.[0] || null;
                              if (file) {
                                const err = validateImageFile(file, "Payment Screenshot");
                                if (err) {
                                  setErrorMsg(err);
                                  return;
                                }
                                setErrorMsg("");
                                setPaymentScreenshot(file);
                                setPaymentPreview(URL.createObjectURL(file));
                              }
                            }}
                          />
                        </label>
                      </div>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center cursor-pointer py-4">
                      <div className="h-12 w-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-2">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                      </div>
                      <span className="text-xs font-bold text-neutral-900 dark:text-white">
                        Click to upload proof of payment
                      </span>
                      <span className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1 text-center">
                        PNG, JPG, or WEBP up to 5MB. Ensure transaction ID / date is clearly visible.
                      </span>
                      <input 
                        type="file" 
                        required 
                        accept="image/png, image/jpeg, image/jpg, image/webp" 
                        className="hidden"
                        onChange={e => {
                          const file = e.target.files?.[0] || null;
                          if (file) {
                            const err = validateImageFile(file, "Payment Screenshot");
                            if (err) {
                              setErrorMsg(err);
                              e.target.value = "";
                              setPaymentScreenshot(null);
                              setPaymentPreview(null);
                              return;
                            }
                            setErrorMsg("");
                            setPaymentScreenshot(file);
                            setPaymentPreview(URL.createObjectURL(file));
                          }
                        }} 
                      />
                    </label>
                  )}
                </div>
              </div>

              {/* Student ID Card Upload (Required for Student-only, Optional otherwise) */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-1.5">
                  Student ID Card Picture {event?.is_student_only ? <span className="text-red-500">*</span> : <span className="text-neutral-400 font-normal">(Optional)</span>}
                </label>
                <div className="relative rounded-2xl border-2 border-dashed border-neutral-300 dark:border-neutral-700 hover:border-blue-500/60 dark:hover:border-blue-500/60 p-5 bg-neutral-50/50 dark:bg-neutral-950/50 transition">
                  {studentIdPreview ? (
                    <div className="flex items-center gap-4">
                      <img src={studentIdPreview} alt="Student ID Preview" className="h-20 w-20 object-cover rounded-xl border border-neutral-200 dark:border-neutral-700 shadow-xs" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-neutral-900 dark:text-white truncate">
                          {studentIdCard?.name}
                        </p>
                        <p className="text-[11px] text-neutral-500 mt-0.5">
                          {studentIdCard ? (studentIdCard.size / 1024).toFixed(1) + " KB" : ""}
                        </p>
                        <label className="mt-2 inline-block cursor-pointer text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline">
                          Replace student ID
                          <input 
                            type="file" 
                            accept="image/png, image/jpeg, image/jpg, image/webp" 
                            className="hidden"
                            onChange={e => {
                              const file = e.target.files?.[0] || null;
                              if (file) {
                                const err = validateImageFile(file, "Student ID Card");
                                if (err) {
                                  setErrorMsg(err);
                                  return;
                                }
                                setErrorMsg("");
                                setStudentIdCard(file);
                                setStudentIdPreview(URL.createObjectURL(file));
                              }
                            }}
                          />
                        </label>
                      </div>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center cursor-pointer py-3">
                      <div className="h-10 w-10 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-1.5">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                        </svg>
                      </div>
                      <span className="text-xs font-bold text-neutral-900 dark:text-white">
                        {event?.is_student_only ? "Upload your Student ID Card (Required)" : "Upload Student ID (Optional)"}
                      </span>
                      <span className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                        PNG or JPG under 5MB. Must show student name & enrollment/roll number.
                      </span>
                      <input 
                        type="file" 
                        required={event?.is_student_only === true || event?.is_student_only === "true"} 
                        accept="image/png, image/jpeg, image/jpg, image/webp" 
                        className="hidden"
                        onChange={e => {
                          const file = e.target.files?.[0] || null;
                          if (file) {
                            const err = validateImageFile(file, "Student ID Card");
                            if (err) {
                              setErrorMsg(err);
                              e.target.value = "";
                              setStudentIdCard(null);
                              setStudentIdPreview(null);
                              return;
                            }
                            setErrorMsg("");
                            setStudentIdCard(file);
                            setStudentIdPreview(URL.createObjectURL(file));
                          }
                        }} 
                      />
                    </label>
                  )}
                </div>
              </div>

              {/* Submit CTA Button */}
              <button 
                type="submit" 
                disabled={submitting} 
                className="w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-8 py-4 text-sm sm:text-base font-black text-white transition-all hover:from-emerald-600 hover:to-emerald-700 active:scale-[0.99] shadow-lg shadow-emerald-500/25 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                    </svg>
                    <span>Submitting Booking for Verification...</span>
                  </>
                ) : (
                  <>
                    <span>Submit Booking for Verification</span>
                    <span>→</span>
                  </>
                )}
              </button>

              <p className="text-center text-[11px] text-neutral-500 dark:text-neutral-400">
                By submitting this request, you agree to Event Ghar&apos;s{" "}
                <Link href="/terms-and-conditions" className="font-semibold text-emerald-600 dark:text-emerald-400 hover:underline">
                  Terms & Conditions
                </Link>.
              </p>

            </form>

          </div>
        </div>

      </div>
    </div>
  );
}
