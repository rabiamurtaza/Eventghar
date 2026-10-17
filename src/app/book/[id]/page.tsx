"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import Link from "next/link";

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
    if (id) init();
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

  if (loading) return <div className="min-h-screen flex items-center justify-center dark:bg-neutral-950 dark:text-white">Loading booking page...</div>;
  
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

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Left Side: Event & Payment Info */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl p-6 border border-neutral-200 dark:border-neutral-800 shadow-sm">
            {event?.image_url && <img src={event.image_url} alt="Event" className="w-full h-48 object-cover rounded-xl mb-4" />}
            <div className="flex items-center justify-between gap-2 mb-2">
              <h2 className="text-2xl font-bold text-neutral-900 dark:text-white">{event?.title}</h2>
              {event?.event_number && (
                <span className="rounded-md bg-neutral-100 dark:bg-neutral-800 px-2.5 py-1 text-xs font-bold text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700">
                  #{event.event_number}
                </span>
              )}
            </div>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4">{event?.start_date} | {event?.venue_name}</p>
            {event?.is_student_only && (
              <span className="inline-block rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800/30 mb-4">
                Student Only Event {event?.university_name && `- ${event.university_name}`}
              </span>
            )}

            <div className="grid grid-cols-2 gap-4 mb-6 text-sm text-neutral-700 dark:text-neutral-300 bg-neutral-50 dark:bg-neutral-950 p-4 rounded-xl border border-neutral-200 dark:border-neutral-800">
              {event?.doors_open_time && <div><span className="font-semibold text-neutral-900 dark:text-white block">Doors Open</span>{event.doors_open_time}</div>}
              {event?.start_time && <div><span className="font-semibold text-neutral-900 dark:text-white block">Start Time</span>{event.start_time}</div>}
              {event?.end_time && <div><span className="font-semibold text-neutral-900 dark:text-white block">End Time</span>{event.end_time}</div>}
              {event?.sales_deadline && <div><span className="font-semibold text-neutral-900 dark:text-white block">Sales Deadline</span>{event.sales_deadline}</div>}
              {event?.organizer_name && <div><span className="font-semibold text-neutral-900 dark:text-white block">Organizer</span>{event.organizer_name}</div>}
              {event?.organizer_contact && <div><span className="font-semibold text-neutral-900 dark:text-white block">Contact</span>{event.organizer_contact}</div>}
            </div>
            <p className="text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap">{event?.description}</p>
          </div>

          <div className="bg-white dark:bg-neutral-900 rounded-2xl p-6 border border-neutral-200 dark:border-neutral-800 shadow-sm">
            <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-4">Payment Instructions</h3>
            {event?.payment_instructions && (
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-6 bg-neutral-50 dark:bg-neutral-950 p-4 rounded-xl border border-neutral-200 dark:border-neutral-800">
                {event.payment_instructions}
              </p>
            )}
            <div className="space-y-3">
              {paymentAccounts.length > 0 ? paymentAccounts.map((acc, i) => (
                <div key={i} className="flex justify-between items-center p-3 bg-neutral-50 dark:bg-neutral-950 rounded-lg border border-neutral-200 dark:border-neutral-800">
                  <span className="font-semibold uppercase text-sm text-neutral-700 dark:text-neutral-300">{acc.method}</span>
                  <span className="font-medium text-neutral-900 dark:text-white">{acc.account_title_number}</span>
                </div>
              )) : (
                <p className="text-sm text-neutral-500">No payment accounts provided by organizer.</p>
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Booking Form */}
        <div className="bg-white dark:bg-neutral-900 rounded-2xl p-6 sm:p-8 border border-neutral-200 dark:border-neutral-800 shadow-sm h-fit">
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-white mb-6 border-b border-neutral-100 dark:border-neutral-800 pb-4">
            Book Tickets
          </h2>

          {errorMsg && (
            <div className="mb-6 p-4 rounded-xl bg-red-50 text-red-600 border border-red-200 dark:bg-red-950/50 dark:border-red-900/50 dark:text-red-400 text-sm font-medium">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Account Information (Read-only from account) */}
            <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/80 dark:bg-neutral-950">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">Booking Ticket Holder</span>
                <Link 
                  href="/my-account" 
                  target="_blank" 
                  className="text-xs font-semibold text-green-600 dark:text-green-400 hover:underline"
                >
                  Edit Name in My Account ↗
                </Link>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-700 dark:bg-green-950/60 dark:text-green-400 font-bold text-sm">
                  {fullName ? fullName.charAt(0).toUpperCase() : "U"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-neutral-900 dark:text-white truncate">
                    {fullName || session?.user?.email?.split('@')[0] || "User"}
                  </p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                    {session?.user?.email}
                  </p>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Phone Number * <span className="text-xs text-neutral-400">(11 digits, e.g. 03001234567)</span>
              </label>
              <input 
                type="tel" 
                required 
                value={phoneNumber} 
                onChange={e => setPhoneNumber(e.target.value)} 
                placeholder="03XXXXXXXXX" 
                className="w-full rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white" 
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Ticket Type *</label>
                <select value={ticketType} onChange={e => setTicketType(e.target.value)} className="w-full rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white">
                  {ticketOptions.map((t, i) => (
                    <option key={i} value={t.name}>{t.name} (Rs. {t.price})</option>
                  ))}
                  {ticketOptions.length === 0 && <option value="general">General (Free)</option>}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Number of Tickets * <span className="text-xs text-neutral-400">({event?.is_student_only ? 'Max 1' : 'Max 3'})</span>
                </label>
                <input 
                  type="number" 
                  required 
                  min={1} 
                  max={event?.is_student_only ? 1 : Math.min(3, event?.max_tickets_per_person || 3)} 
                  value={numberOfTickets} 
                  onChange={e => {
                    let val = parseInt(e.target.value) || 1;
                    const maxVal = event?.is_student_only ? 1 : Math.min(3, event?.max_tickets_per_person || 3);
                    if (val > maxVal) val = maxVal;
                    if (val < 1) val = 1;
                    setNumberOfTickets(val);
                  }} 
                  className="w-full rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white" 
                />
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
                Upload Payment Screenshot * <span className="text-xs font-normal text-neutral-400">(.png, .jpg, .jpeg under 5MB)</span>
              </label>
              <p className="text-xs text-neutral-500 mb-3">Please pay Rs. {totalPrice.toLocaleString()} to one of the accounts listed on the left and upload the proof here.</p>
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

            <div className="p-4 bg-neutral-50 dark:bg-neutral-900/50 rounded-xl border border-neutral-200 dark:border-neutral-800">
              <label className="block text-sm font-bold text-neutral-900 dark:text-white mb-2">
                Student ID Card Picture {event?.is_student_only === true || event?.is_student_only === "true" ? <span className="text-red-500">*</span> : <span className="text-neutral-400 font-normal">(Optional)</span>}
                <span className="text-xs font-normal text-neutral-400 block sm:inline sm:ml-2">(.png, .jpg, .jpeg under 5MB)</span>
              </label>
              <p className="text-xs text-neutral-500 mb-3">
                {event?.is_student_only === true || event?.is_student_only === "true" ? "This is a student-only event. You must upload your student ID." : "Upload your student ID if applicable."}
              </p>
              <input 
                type="file" 
                required={event?.is_student_only === true || event?.is_student_only === "true"} 
                accept="image/png, image/jpeg, image/jpg, image/webp" 
                onChange={e => {
                  const file = e.target.files?.[0] || null;
                  if (file) {
                    const err = validateImageFile(file, "Student ID Card");
                    if (err) {
                      setErrorMsg(err);
                      e.target.value = "";
                      setStudentIdCard(null);
                      return;
                    }
                    setErrorMsg("");
                  }
                  setStudentIdCard(file);
                }} 
                className="w-full text-sm text-neutral-900 dark:text-neutral-300 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900/30 dark:file:text-blue-400" 
              />
            </div>

            <button type="submit" disabled={submitting} className="mt-4 w-full rounded-xl bg-green-500 px-8 py-3.5 text-base font-bold text-white transition hover:bg-green-600 active:translate-y-0 shadow-lg shadow-green-500/30 disabled:opacity-50">
              {submitting ? "Submitting Request..." : "Request Review / Submit"}
            </button>
          </form>

        </div>
      </div>
    </div>
  );
}
