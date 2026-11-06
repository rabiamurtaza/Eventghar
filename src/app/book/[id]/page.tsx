"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import Link from "next/link";
import { getEventLifecycle } from "@/utils/eventLifecycle";

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

function normalizePhoneNumber(phone: string): string {
  let cleaned = phone.replace(/[\s\-\(\)]/g, "");
  if (cleaned.startsWith("+92")) {
    cleaned = "0" + cleaned.slice(3);
  } else if (cleaned.startsWith("92") && cleaned.length === 12) {
    cleaned = "0" + cleaned.slice(2);
  }
  return cleaned;
}

function formatAccountDetails(raw: string) {
  if (!raw) return { title: "", number: "" };
  // Check if separated by " - ", ":", "/", or "|" followed by account/phone number
  const sepMatch = raw.match(/^(.*?)(?:\s*[-–—:|/]\s*)(03\d{9}|\+?92\d{10}|\d{9,16})$/i);
  if (sepMatch) {
    return { title: sepMatch[1].trim(), number: sepMatch[2].trim() };
  }
  // Check if ends with a phone number / account number (e.g. "Abdul Wase 03001234567")
  const endNumberMatch = raw.match(/^(.*?)[\s]+(03\d{9}|\+?92\d{10}|\d{9,16})$/);
  if (endNumberMatch) {
    return { title: endNumberMatch[1].trim(), number: endNumberMatch[2].trim() };
  }
  return { title: "", number: raw };
}

function format12HourTime(timeStr?: string): string {
  if (!timeStr) return "";
  const parts = timeStr.split(":");
  if (parts.length >= 2) {
    const hours = parseInt(parts[0], 10);
    const minutes = parts[1].slice(0, 2);
    if (!isNaN(hours)) {
      const ampm = hours >= 12 ? "PM" : "AM";
      const h12 = hours % 12 || 12;
      return `${h12}:${minutes} ${ampm}`;
    }
  }
  return timeStr;
}

function formatSimpleDate(dateStr?: string): string {
  if (!dateStr) return "";
  const dateOnly = dateStr.includes("T") ? dateStr.split("T")[0] : dateStr.split(" ")[0];
  const parts = dateOnly.split("-");
  if (parts.length === 3) {
    const year = parts[0];
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    if (!isNaN(month) && !isNaN(day) && months[month]) {
      return `${day} ${months[month]} ${year}`;
    }
  }
  return dateStr;
}

function formatDeadlineDisplay(deadlineStr?: string): string {
  if (!deadlineStr) return "";
  const [datePart, timePart] = deadlineStr.includes("T") ? deadlineStr.split("T") : deadlineStr.split(" ");
  const formattedDate = formatSimpleDate(datePart);
  if (timePart) {
    const formattedTime = format12HourTime(timePart);
    return `${formattedDate}, ${formattedTime}`;
  }
  return formattedDate;
}

export default function BookTicketPage() {
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : (params.id ?? "");
  const router = useRouter();

  const [session, setSession] = useState<any>(null);
  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Inventory & Capacity state
  const [totalBooked, setTotalBooked] = useState(0);
  const [tierBookings, setTierBookings] = useState<Record<string, number>>({});

  // Form State
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [hasSavedPhone, setHasSavedPhone] = useState(false);
  const [ticketType, setTicketType] = useState("");
  const [numberOfTickets, setNumberOfTickets] = useState(1);
  const [paymentScreenshot, setPaymentScreenshot] = useState<File | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [ticketOptions, setTicketOptions] = useState<any[]>([]);
  const [paymentAccounts, setPaymentAccounts] = useState<any[]>([]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const supabase = useMemo(() => createClient(), []);
  const eventIdRef = useRef<string | null>(null);

  const handleCopyAccount = (textToCopy: string, index: number) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(textToCopy);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    }
  };

  useEffect(() => {
    async function init() {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push(`/login?redirect=${encodeURIComponent(`/book/${id}`)}`);
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
      if (fetchedPhone && fetchedPhone.trim().length > 0) {
        setPhoneNumber(fetchedPhone.trim());
        setHasSavedPhone(true);
      } else {
        setHasSavedPhone(false);
      }

      let query = supabase.from('events').select('*');
      const isNum = !isNaN(Number(id)) && !isNaN(parseInt(id, 10));
      if (isNum) {
        query = query.eq('event_number', parseInt(id, 10));
      } else {
        query = query.eq('id', id);
      }
      const { data: eventData } = await query.maybeSingle();

      if (eventData) {
        eventIdRef.current = eventData.id;
        setEvent(eventData);

        // Fetch active bookings for capacity & tier inventory tracking
        const { data: bookingsData } = await supabase
          .from('bookings')
          .select('ticket_type, number_of_tickets, status')
          .eq('event_id', eventData.id)
          .in('status', ['verified', 'confirmed', 'pending']);

        let total = 0;
        const byTier: Record<string, number> = {};
        if (bookingsData) {
          bookingsData.forEach((b: any) => {
            const count = Number(b.number_of_tickets) || 1;
            total += count;
            const tType = b.ticket_type || 'Standard';
            byTier[tType] = (byTier[tType] || 0) + count;
          });
        }
        setTotalBooked(total);
        setTierBookings(byTier);

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
          // Set to first tier that is not sold out if possible
          const firstAvailable = tiers.find(t => {
            const tLimit = t.total ? Number(t.total) : null;
            const tBooked = byTier[t.name] || 0;
            return tLimit === null || (tLimit - tBooked) > 0;
          });
          setTicketType(firstAvailable ? firstAvailable.name : tiers[0].name);
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
    if (id) init();

    // Live inventory & event updates via Realtime
    const channel = supabase
      .channel(`book-event-${id}-realtime`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bookings" },
        async () => {
          const currentEventId = eventIdRef.current;
          if (!currentEventId) return;
          const { data: bData } = await supabase
            .from('bookings')
            .select('ticket_type, number_of_tickets, status')
            .eq('event_id', currentEventId)
            .in('status', ['verified', 'confirmed', 'pending']);
          if (bData) {
            let total = 0;
            const byTier: Record<string, number> = {};
            bData.forEach((b: any) => {
              const count = Number(b.number_of_tickets) || 1;
              total += count;
              const tType = b.ticket_type || 'Standard';
              byTier[tType] = (byTier[tType] || 0) + count;
            });
            setTotalBooked(total);
            setTierBookings(byTier);
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "events" },
        async (payload: any) => {
          // Only refresh when THIS event changed, and never reset what the user has typed/selected
          const currentEventId = eventIdRef.current;
          const changedId = payload?.new?.id || payload?.old?.id;
          if (!currentEventId || changedId !== currentEventId) return;

          const { data: fresh } = await supabase.from('events').select('*').eq('id', currentEventId).maybeSingle();
          if (!fresh) return;
          setEvent(fresh);

          if (fresh.ticket_price) {
            try {
              const parsed = typeof fresh.ticket_price === 'string' ? JSON.parse(fresh.ticket_price) : fresh.ticket_price;
              if (Array.isArray(parsed) && parsed.length > 0) {
                setTicketOptions(parsed);
                setTicketType(prev => parsed.some((t: any) => t.name === prev) ? prev : parsed[0].name);
              }
            } catch (e) {}
          }
          if (fresh.payment_accounts) {
            try {
              const parsed = typeof fresh.payment_accounts === 'string' ? JSON.parse(fresh.payment_accounts) : fresh.payment_accounts;
              if (Array.isArray(parsed)) setPaymentAccounts(parsed);
            } catch (e) {}
          }
        }
      )
      .subscribe();

    // Re-sync profile details when user focuses tab (e.g. if updated in My Account)
    const handleProfileSync = async () => {
      const { data: { session: activeSession } } = await supabase.auth.getSession();
      if (!activeSession) return;

      const { data: uProf } = await supabase
        .from('users')
        .select('full_name, phone_number')
        .eq('id', activeSession.user.id)
        .maybeSingle();

      let pName = uProf?.full_name || "";
      let pPhone = uProf?.phone_number || "";

      if (!pPhone) {
        const { data: oProf } = await supabase
          .from('organizers')
          .select('full_name, phone_number')
          .eq('id', activeSession.user.id)
          .maybeSingle();
        pName = oProf?.full_name || pName;
        pPhone = oProf?.phone_number || "";
      }

      if (pName) setFullName(pName);
      if (pPhone && pPhone.trim().length > 0) {
        setPhoneNumber(pPhone.trim());
        setHasSavedPhone(true);
      }
    };

    window.addEventListener("focus", handleProfileSync);
    document.addEventListener("visibilitychange", handleProfileSync);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener("focus", handleProfileSync);
      document.removeEventListener("visibilitychange", handleProfileSync);
    };
  }, [id, router, supabase]);

  // Compute event lifecycle & remaining inventory
  const lifecycle = getEventLifecycle(event, totalBooked);
  const overallRemaining = lifecycle.remainingTickets;

  const selectedTicket = ticketOptions.find(t => t.name === ticketType);
  const selectedTierLimit = selectedTicket && selectedTicket.total ? Number(selectedTicket.total) : null;
  const tierBookedCount = tierBookings[ticketType] || 0;
  const tierRemaining = selectedTierLimit !== null ? Math.max(0, selectedTierLimit - tierBookedCount) : null;

  // Maximum allowed is the number of tickets still available (stock) with no artificial cap
  const availableStock = Math.min(
    overallRemaining !== null ? overallRemaining : Infinity,
    tierRemaining !== null ? tierRemaining : Infinity
  );

  const maxAllowedTickets = isFinite(availableStock) ? Math.max(0, availableStock) : 999;

  // Keep selected quantity strictly within [1, maxAllowedTickets]
  useEffect(() => {
    if (maxAllowedTickets > 0 && numberOfTickets > maxAllowedTickets) {
      setNumberOfTickets(maxAllowedTickets);
    } else if (numberOfTickets < 1) {
      setNumberOfTickets(1);
    }
  }, [maxAllowedTickets, numberOfTickets]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg("");

    if (!event || !event.id) {
      setErrorMsg("Event could not be found. Please refresh and try again.");
      setSubmitting(false);
      return;
    }

    // Double-check real-time event status and capacity limits
    const currentLifecycle = getEventLifecycle(event, totalBooked);
    if (!currentLifecycle.canBook) {
      setErrorMsg(currentLifecycle.reason || "Booking is currently unavailable for this event.");
      setSubmitting(false);
      return;
    }

    // Backend-grade quantity validation: at least 1 and within available stock
    const qty = parseInt(String(numberOfTickets), 10);
    if (isNaN(qty) || qty < 1) {
      setErrorMsg("Number of tickets must be at least 1.");
      setSubmitting(false);
      return;
    }

    if (overallRemaining !== null && qty > overallRemaining) {
      setErrorMsg(`Cannot book ${qty} ticket(s). Only ${overallRemaining} ticket(s) are remaining for this event.`);
      setSubmitting(false);
      return;
    }

    if (tierRemaining !== null && qty > tierRemaining) {
      setErrorMsg(`Only ${tierRemaining} ticket(s) remaining for ${ticketType}. Please adjust quantity.`);
      setSubmitting(false);
      return;
    }

    if (maxAllowedTickets > 0 && qty > maxAllowedTickets) {
      setErrorMsg(`Cannot book ${qty} ticket(s). Only ${maxAllowedTickets} ticket(s) are available.`);
      setSubmitting(false);
      return;
    }
    
    const cleanPhone = normalizePhoneNumber(phoneNumber);
    if (!cleanPhone || !/^\d{11}$/.test(cleanPhone)) {
      setErrorMsg("Please provide a valid 11-digit phone number (e.g. 03001234567).");
      setSubmitting(false);
      return;
    }

    // Payment screenshot is compulsory for every booking.
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

    const supabase = createClient();

    // Verify latest database bookings at time of submission to prevent overselling
    const { data: freshBookings } = await supabase
      .from('bookings')
      .select('ticket_type, number_of_tickets')
      .eq('event_id', event.id)
      .in('status', ['verified', 'confirmed', 'pending']);

    let freshTotal = 0;
    let freshTierTotal = 0;
    if (freshBookings) {
      freshBookings.forEach((b: any) => {
        const count = Number(b.number_of_tickets) || 1;
        freshTotal += count;
        if (b.ticket_type === (ticketType || 'Standard')) {
          freshTierTotal += count;
        }
      });
    }

    const freshOverallRem = event.total_tickets ? Math.max(0, Number(event.total_tickets) - freshTotal) : null;
    const freshTierRem = selectedTierLimit !== null ? Math.max(0, selectedTierLimit - freshTierTotal) : null;
    const freshMaxAvailable = Math.min(
      freshOverallRem !== null ? freshOverallRem : Infinity,
      freshTierRem !== null ? freshTierRem : Infinity
    );

    if (isFinite(freshMaxAvailable) && qty > freshMaxAvailable) {
      setErrorMsg(`Sorry, available tickets just changed! Only ${freshMaxAvailable} ticket(s) remain.`);
      setSubmitting(false);
      return;
    }

    let paymentScreenshotUrl = "";
    let studentIdUrl = null;

    try {
      // Upload Payment Screenshot (required - validated above)
      {
        const pExt = paymentScreenshot.name.split('.').pop();
        const pName = `payment-${Date.now()}-${Math.random().toString(36).substring(2)}.${pExt}`;
        const { error: pError } = await supabase.storage.from('payment-screenshots').upload(pName, paymentScreenshot);
        if (pError) throw pError;
        const { data: pData } = supabase.storage.from('payment-screenshots').getPublicUrl(pName);
        paymentScreenshotUrl = pData.publicUrl;
      }

      const payload = {
        event_id: event.id,
        user_email: session.user.email,
        full_name: fullName.trim(),
        phone_number: cleanPhone,
        ticket_type: ticketType || 'Standard',
        number_of_tickets: qty,
        payment_screenshot_url: paymentScreenshotUrl,
        student_id_url: studentIdUrl,
        status: 'pending'
      };

      const { error: insertError } = await supabase.from('bookings').insert([payload]);
      if (insertError) throw insertError;

      // Update phone_number and full_name in appropriate profile without overwriting organizer role
      try {
        const { data: orgCheck } = await supabase
          .from('organizers')
          .select('id')
          .eq('id', session.user.id)
          .maybeSingle();

        if (orgCheck) {
          await supabase.from('organizers').update({
            full_name: fullName.trim(),
            phone_number: cleanPhone,
          }).eq('id', session.user.id);
        } else {
          await supabase.from('users').upsert({
            id: session.user.id,
            email: session.user.email,
            full_name: fullName.trim(),
            phone_number: cleanPhone,
          }, { onConflict: 'id' });
        }
        setHasSavedPhone(true);
      } catch (profileErr) {
        console.error("Failed to update user profile with phone number:", profileErr);
      }

      setSuccess(true);
    } catch (err: any) {
      setErrorMsg(err.message || "An error occurred during booking. Make sure the bookings table and storage buckets exist.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center dark:bg-neutral-950 dark:text-white">Loading booking page...</div>;

  if (!event) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-950 px-4">
        <div className="max-w-md w-full bg-white dark:bg-neutral-900 rounded-2xl p-8 text-center shadow-lg border border-neutral-200 dark:border-neutral-800">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-white mb-2">Event Not Found</h2>
          <p className="text-neutral-600 dark:text-neutral-400 mb-6 text-sm">
            The event you are trying to book does not exist or may have been removed.
          </p>
          <Link href="/#events" className="inline-block w-full rounded-xl bg-green-500 px-6 py-3 font-bold text-white transition hover:bg-green-600 shadow-lg shadow-green-500/30">
            Browse Other Events
          </Link>
        </div>
      </div>
    );
  }

  // Blocked Lifecycle Screen (Sold Out, Sales Closed, or Ended)
  if (event && !lifecycle.canBook) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-950 px-4">
        <div className="max-w-md w-full bg-white dark:bg-neutral-900 rounded-2xl p-8 text-center shadow-lg border border-neutral-200 dark:border-neutral-800">
          <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-6 text-2xl font-bold">
            {lifecycle.status === 'sold_out' ? '🎟️' : lifecycle.status === 'ended' ? '🏁' : '⏱️'}
          </div>
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-white mb-2">
            {lifecycle.status === 'sold_out' 
              ? 'Event Sold Out' 
              : lifecycle.status === 'sales_closed' 
                ? 'Ticket Sales Closed' 
                : 'Event Concluded'}
          </h2>
          <p className="text-neutral-600 dark:text-neutral-400 mb-6 text-sm">
            {lifecycle.reason || 'Bookings are currently unavailable for this event.'}
          </p>
          <Link href="/#events" className="inline-block w-full rounded-xl bg-green-500 px-6 py-3 font-bold text-white transition hover:bg-green-600 shadow-lg shadow-green-500/30">
            Browse Other Events
          </Link>
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
            Your booking request has been received and is being reviewed by the organizer. Once confirmed, your ticket and QR code will appear directly under My Account in &quot;My Tickets&quot;. You can present your digital pass at the entrance on the day of the event.
          </p>
          <Link href="/" className="inline-block w-full rounded-xl bg-green-500 px-6 py-3 font-bold text-white transition hover:bg-green-600 shadow-lg shadow-green-500/30">
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  // Determine selected ticket price
  const parsePrice = (p: unknown) => parseFloat(String(p ?? '0').replace(/,/g, ''));
  const pricePerTicket = selectedTicket ? parsePrice(selectedTicket.price) : 0;
  const totalPrice = isNaN(pricePerTicket) ? 0 : pricePerTicket * numberOfTickets;

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Left Side: Event & Payment Info */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl p-4 sm:p-6 border border-neutral-200 dark:border-neutral-800 shadow-sm">
            {event.image_url && <img src={event.image_url} alt="Event" className="w-full h-48 object-cover rounded-xl mb-4" />}
            <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-2 mb-2">
              <h2 className="text-xl sm:text-2xl font-bold text-neutral-900 dark:text-white">{event.title}</h2>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className={`rounded-full ${lifecycle.badgeBg} ${lifecycle.badgeText} px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider`}>
                  {lifecycle.label}
                </span>
                {event.event_number && (
                  <span className="rounded-md bg-neutral-100 dark:bg-neutral-800 px-2.5 py-1 text-xs font-bold text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700">
                    #{event.event_number}
                  </span>
                )}
              </div>
            </div>
            <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 mb-4">{formatSimpleDate(event.start_date)} | {event.venue_name}</p>
            {event.is_student_only && (
              <span className="inline-block rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800/30 mb-4">
                Student Only Event {event.university_name && `- ${event.university_name}`}
              </span>
            )}

            <div className="grid grid-cols-2 gap-2.5 sm:gap-4 mb-6 text-xs sm:text-sm text-neutral-700 dark:text-neutral-300 bg-neutral-50 dark:bg-neutral-950 p-3.5 sm:p-4 rounded-xl border border-neutral-200 dark:border-neutral-800">
              {event.doors_open_time && <div><span className="font-semibold text-neutral-500 dark:text-neutral-400 text-[10px] sm:text-xs uppercase tracking-wider block">Doors Open</span><span className="text-neutral-900 dark:text-white font-medium">{format12HourTime(event.doors_open_time)}</span></div>}
              {event.start_time && <div><span className="font-semibold text-neutral-500 dark:text-neutral-400 text-[10px] sm:text-xs uppercase tracking-wider block">Start Time</span><span className="text-neutral-900 dark:text-white font-medium">{format12HourTime(event.start_time)}</span></div>}
              {event.end_time && <div><span className="font-semibold text-neutral-500 dark:text-neutral-400 text-[10px] sm:text-xs uppercase tracking-wider block">End Time</span><span className="text-neutral-900 dark:text-white font-medium">{format12HourTime(event.end_time)}</span></div>}
              {event.sales_deadline && <div className="col-span-2 sm:col-span-1"><span className="font-semibold text-neutral-500 dark:text-neutral-400 text-[10px] sm:text-xs uppercase tracking-wider block">Sales Deadline</span><span className="text-neutral-900 dark:text-white font-medium">{formatDeadlineDisplay(event.sales_deadline)}</span></div>}
              {event.organizer_name && <div><span className="font-semibold text-neutral-500 dark:text-neutral-400 text-[10px] sm:text-xs uppercase tracking-wider block">Organizer</span><span className="text-neutral-900 dark:text-white font-medium">{event.organizer_name}</span></div>}
            </div>
            <p className="text-neutral-700 dark:text-neutral-300 text-xs sm:text-sm whitespace-pre-wrap leading-relaxed">{event.description}</p>
          </div>

          <div className="bg-white dark:bg-neutral-900 rounded-2xl p-4 sm:p-6 border border-neutral-200 dark:border-neutral-800 shadow-sm">
            <h3 className="text-base sm:text-lg font-bold text-neutral-900 dark:text-white mb-3">Payment Instructions</h3>
            {event.payment_instructions && (
              <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400 mb-4 bg-neutral-50 dark:bg-neutral-950 p-3 sm:p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 leading-relaxed whitespace-pre-wrap">
                {event.payment_instructions}
              </p>
            )}
            <div className="space-y-3">
              {paymentAccounts.length > 0 ? paymentAccounts.map((acc, i) => {
                const details = formatAccountDetails(acc.account_title_number || "");
                const textToCopy = details.number || acc.account_title_number || "";

                return (
                  <div key={i} className="p-3.5 bg-neutral-50 dark:bg-neutral-950/70 rounded-xl border border-neutral-200 dark:border-neutral-800 transition">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200/60 dark:border-purple-800/60">
                        {acc.method}
                      </span>
                      {textToCopy && (
                        <button
                          type="button"
                          onClick={() => handleCopyAccount(textToCopy, i)}
                          className="text-[11px] font-semibold text-neutral-500 hover:text-neutral-900 dark:hover:text-white flex items-center gap-1 transition cursor-pointer"
                          title="Copy account details"
                        >
                          {copiedIndex === i ? (
                            <span className="text-green-600 dark:text-green-400 font-bold">✓ Copied</span>
                          ) : (
                            <span>📋 Copy</span>
                          )}
                        </button>
                      )}
                    </div>

                    {details.title && details.number ? (
                      <div className="flex flex-col gap-0.5 mt-1">
                        <div className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">
                          Title: <span className="font-semibold text-neutral-900 dark:text-white">{details.title}</span>
                        </div>
                        <div className="text-xs sm:text-sm font-bold text-neutral-900 dark:text-white font-mono tracking-wide break-words select-all">
                          {details.number}
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs sm:text-sm font-semibold text-neutral-900 dark:text-white break-words select-all mt-1">
                        {acc.account_title_number}
                      </div>
                    )}
                  </div>
                );
              }) : (
                <p className="text-xs sm:text-sm text-neutral-500">No payment accounts provided by organizer.</p>
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Booking Form */}
        <div className="bg-white dark:bg-neutral-900 rounded-2xl p-4 sm:p-6 md:p-8 border border-neutral-200 dark:border-neutral-800 shadow-sm h-fit">
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-white mb-4 border-b border-neutral-100 dark:border-neutral-800 pb-4">
            Book Tickets
          </h2>

          {errorMsg && (
            <div className="mb-6 p-4 rounded-xl bg-red-50 text-red-600 border border-red-200 dark:bg-red-950/50 dark:border-red-900/50 dark:text-red-400 text-sm font-medium">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Contact Details (Clean, standard form fields) */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Full Name
              </label>
              <input 
                type="text" 
                disabled 
                value={fullName}
                className="w-full rounded-lg border border-neutral-300 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-900 px-3 py-2 text-sm text-neutral-800 dark:text-neutral-200 cursor-not-allowed outline-none" 
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Email Address
                </label>
                <input 
                  type="email" 
                  disabled 
                  value={session?.user?.email || ""}
                  className="w-full rounded-lg border border-neutral-300 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-900 px-3 py-2 text-sm text-neutral-800 dark:text-neutral-200 cursor-not-allowed outline-none truncate" 
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Phone Number *
                </label>
                {hasSavedPhone ? (
                  <input 
                    type="tel" 
                    disabled 
                    value={phoneNumber} 
                    className="w-full rounded-lg border border-neutral-300 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-900 px-3 py-2 text-sm text-neutral-800 dark:text-neutral-200 cursor-not-allowed outline-none" 
                  />
                ) : (
                  <input 
                    type="tel" 
                    required 
                    value={phoneNumber} 
                    onChange={e => setPhoneNumber(e.target.value)} 
                    placeholder="03XXXXXXXXX" 
                    className="w-full rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white" 
                  />
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">Ticket Type *</label>
                <select 
                  value={ticketType} 
                  onChange={e => {
                    setTicketType(e.target.value);
                    setNumberOfTickets(1);
                  }} 
                  className="w-full h-12 rounded-xl border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
                >
                  {ticketOptions.map((t, i) => {
                    const tLimit = t.total ? Number(t.total) : null;
                    const tBooked = tierBookings[t.name] || 0;
                    const tLeft = tLimit !== null ? Math.max(0, tLimit - tBooked) : null;
                    const isTierSoldOut = tLeft !== null && tLeft <= 0;
                    return (
                      <option key={i} value={t.name} disabled={isTierSoldOut}>
                        {t.name} ({parseFloat(String(t.price ?? '0').replace(/,/g, '')) > 0 ? `Rs. ${t.price}` : 'Free'}) {isTierSoldOut ? '— Sold Out' : ''}
                      </option>
                    );
                  })}
                  {ticketOptions.length === 0 && <option value="Standard">Standard (Free)</option>}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
                  Number of Tickets *
                </label>

                {/* Quantity Stepper */}
                <div className="flex items-center">
                  <div className="inline-flex items-center rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 p-1 shadow-xs">
                    {/* Minus button: red icon, min 44px tap target, disabled/greyed out at 1 */}
                    <button
                      type="button"
                      onClick={() => setNumberOfTickets(prev => Math.max(1, prev - 1))}
                      disabled={numberOfTickets <= 1}
                      aria-label="Decrease tickets"
                      className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg bg-white dark:bg-neutral-900 text-red-600 dark:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 border border-neutral-200 dark:border-neutral-800 transition focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 dark:focus:ring-offset-neutral-900 disabled:opacity-30 disabled:text-neutral-400 dark:disabled:text-neutral-600 disabled:hover:bg-white dark:disabled:hover:bg-neutral-900 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
                      </svg>
                    </button>

                    {/* Middle: bold black number */}
                    <span 
                      className="w-14 text-center font-bold text-neutral-900 dark:text-white text-lg select-none"
                      aria-live="polite"
                    >
                      {numberOfTickets}
                    </span>

                    {/* Plus button: black icon, min 44px tap target, disabled/greyed out at max stock */}
                    <button
                      type="button"
                      onClick={() => setNumberOfTickets(prev => Math.min(maxAllowedTickets, prev + 1))}
                      disabled={numberOfTickets >= maxAllowedTickets}
                      aria-label="Increase tickets"
                      className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 border border-neutral-200 dark:border-neutral-800 transition focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 dark:focus:ring-offset-neutral-900 disabled:opacity-30 disabled:text-neutral-400 dark:disabled:text-neutral-600 disabled:hover:bg-white dark:disabled:hover:bg-neutral-900 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* "N tickets left" is hidden: buyers can only see their own bookings, so the
                    number would be inaccurate. Admin/organizer pages show the real count. */}
                {maxAllowedTickets <= 0 && (
                  <p className="text-xs font-semibold text-red-600 dark:text-red-400 mt-1.5 flex items-center gap-1">
                    <span>⚠️</span>
                    <span>Sold out</span>
                  </p>
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-neutral-100 dark:border-neutral-800">
              <div className="flex justify-between items-center mb-4">
                <span className="font-bold text-neutral-900 dark:text-white text-lg">Total to Pay:</span>
                <span className="font-bold text-green-500 text-xl">Rs. {totalPrice.toLocaleString()}</span>
              </div>
            </div>

            <div className="p-4 bg-neutral-50 dark:bg-neutral-900/50 rounded-xl border border-neutral-200 dark:border-neutral-800">
              <label className="block text-sm font-bold text-neutral-900 dark:text-white mb-2">
                Upload Payment Screenshot *
              </label>
              <input
                type="file"
                required
                accept="image/png, image/jpeg, image/jpg, image/webp" 
                onChange={e => {
                  const file = e.target.files?.[0] || null;
                  if (file) {
                    const err = validateImageFile(file, "Payment Screenshot");
                    if (err) {
                      setErrorMsg(err);
                      e.target.value = "";
                      setPaymentScreenshot(null);
                      return;
                    }
                    setErrorMsg("");
                  }
                  setPaymentScreenshot(file);
                }} 
                className="w-full text-sm text-neutral-900 dark:text-neutral-300 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100 dark:file:bg-green-900/30 dark:file:text-green-400"
              />
            </div>

            <button type="submit" disabled={submitting} className="mt-4 w-full rounded-xl bg-green-500 px-8 py-3.5 text-base font-bold text-white transition hover:bg-green-600 active:translate-y-0 shadow-lg shadow-green-500/30 disabled:opacity-50 cursor-pointer">
              {submitting ? "Submitting Request..." : "Request Review / Submit"}
            </button>
          </form>

        </div>
      </div>
    </div>
  );
}
