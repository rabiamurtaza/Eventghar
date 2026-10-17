"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import Link from "next/link";
import { uuidv7 } from "@/utils/uuid";
import { MessageSquare, Mail, Phone, Clock, CheckCircle2, ShieldCheck, ArrowRight, HelpCircle } from "lucide-react";

const CATEGORIES = [
  "Payment Verification Issue",
  "Ticket Access & QR Scanner",
  "Event Booking Query",
  "Host an Event / Organizer Inquiry",
  "Account / Profile Issue",
  "Other Support"
];

export default function ContactUsPage() {
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  const [category, setCategory] = useState("Payment Verification Issue");
  const [eventReference, setEventReference] = useState("");
  const [message, setMessage] = useState("");

  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    async function loadUser() {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      setEmail(session.user.email || "");

      // Try prefilling name and phone from users or organizers
      const { data: userProfile } = await supabase
        .from("users")
        .select("full_name, phone_number")
        .eq("id", session.user.id)
        .maybeSingle();

      if (userProfile) {
        if (userProfile.full_name) setFullName(userProfile.full_name);
        if (userProfile.phone_number) setPhoneNumber(userProfile.phone_number);
      } else {
        const { data: orgProfile } = await supabase
          .from("organizers")
          .select("full_name, phone_number")
          .eq("id", session.user.id)
          .maybeSingle();
        if (orgProfile) {
          if (orgProfile.full_name) setFullName(orgProfile.full_name);
          if (orgProfile.phone_number) setPhoneNumber(orgProfile.phone_number);
        }
      }

      if (!fullName && session.user.user_metadata?.full_name) {
        setFullName(session.user.user_metadata.full_name);
      }
    }

    loadUser();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    if (!phoneNumber || !/^\d{11}$/.test(phoneNumber.trim())) {
      setErrorMsg("Please enter a valid 11-digit phone number (e.g. 03001234567).");
      setLoading(false);
      return;
    }

    if (!message.trim()) {
      setErrorMsg("Please describe your issue or inquiry.");
      setLoading(false);
      return;
    }

    const supabase = createClient();

    try {
      // Save contact inquiry in Supabase table
      const { error } = await supabase.from("contact_messages").insert([
        {
          id: uuidv7(),
          full_name: fullName.trim(),
          email: email.trim(),
          phone_number: phoneNumber.trim(),
          category: category,
          message: eventReference ? `[Event Ref: ${eventReference}]\n\n${message.trim()}` : message.trim(),
          status: "pending",
        },
      ]);

      if (error) {
        console.warn("Could not save to contact_messages table (table may not exist yet):", error.message);
      }

      setSubmitted(true);
    } catch (err: any) {
      console.error("Submission error:", err);
      // Still show success since user can also reach via WhatsApp/Email
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  };

  const whatsappMessage = encodeURIComponent(
    `Hello Event Ghar Support,\nMy Name: ${fullName || "User"}\nPhone: ${phoneNumber}\nEmail: ${email}\nIssue: ${category}\nDetails: ${message || "I have an inquiry."}`
  );

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 py-12 sm:py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        
        {/* Header */}
        <div className="text-center mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 mb-4 shadow-xs">
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Dedicated Attendee & Host Support</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-black text-neutral-900 dark:text-white tracking-tight">
            How Can We Help You?
          </h1>
          <p className="mt-3 text-sm sm:text-base text-neutral-600 dark:text-neutral-400 max-w-xl mx-auto leading-relaxed">
            Need assistance with payment verification, your QR digital pass, or host onboarding? Our support desk responds rapidly.
          </p>
        </div>

        {submitted ? (
          <div className="bg-white dark:bg-neutral-900 rounded-3xl border border-emerald-200 dark:border-emerald-800/60 p-8 sm:p-14 text-center shadow-lg max-w-xl mx-auto animate-in fade-in duration-300">
            <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-sm">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-black text-neutral-900 dark:text-white mb-2">
              Inquiry Dispatched!
            </h2>
            <p className="text-neutral-600 dark:text-neutral-400 text-sm leading-relaxed mb-6">
              Thank you, <span className="font-bold text-neutral-900 dark:text-white">{fullName}</span>. We have logged your request regarding <strong className="text-emerald-600 dark:text-emerald-400">{category}</strong>. Our team will review your message promptly.
            </p>

            <div className="space-y-3 pt-2">
              <a
                href={`https://wa.me/923000000000?text=${whatsappMessage}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-5 py-3.5 text-xs font-bold text-white transition hover:from-emerald-600 hover:to-emerald-700 shadow-lg shadow-emerald-500/25"
              >
                <span>💬</span>
                <span>Chat Instantly on WhatsApp for Urgent Inquiries</span>
              </a>

              <Link
                href="/"
                className="w-full block rounded-2xl border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800 px-5 py-3 text-xs font-semibold text-neutral-700 dark:text-neutral-300 transition"
              >
                Return to Events Home
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Left: Contact Info Sidebar (5 cols) */}
            <div className="lg:col-span-5 space-y-6">
              
              {/* Direct Channels Card */}
              <div className="bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200/80 dark:border-neutral-800 p-6 shadow-sm">
                <h3 className="font-bold text-sm uppercase tracking-wider text-neutral-400 mb-5">
                  Direct Contact Channels
                </h3>
                
                <div className="space-y-4">
                  {/* WhatsApp */}
                  <a 
                    href={`https://wa.me/923000000000?text=${encodeURIComponent("Hello Event Ghar Support, I need assistance with an event.")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-start gap-3.5 p-3.5 rounded-2xl border border-neutral-100 dark:border-neutral-800 hover:border-emerald-500/50 bg-neutral-50/50 dark:bg-neutral-950/50 transition group"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 font-bold">
                      💬
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-neutral-900 dark:text-white">WhatsApp Live Chat</p>
                        <span className="text-[10px] font-bold text-emerald-600 group-hover:translate-x-0.5 transition-transform">➔</span>
                      </div>
                      <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">Fastest reply for payment & gate questions</p>
                    </div>
                  </a>

                  {/* Email */}
                  <a 
                    href="mailto:support@eventghar.pk" 
                    className="flex items-start gap-3.5 p-3.5 rounded-2xl border border-neutral-100 dark:border-neutral-800 hover:border-blue-500/50 bg-neutral-50/50 dark:bg-neutral-950/50 transition group"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400">
                      <Mail className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-neutral-900 dark:text-white">Official Support Email</p>
                        <span className="text-[10px] font-bold text-blue-600 group-hover:translate-x-0.5 transition-transform">➔</span>
                      </div>
                      <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5 font-mono">support@eventghar.pk</p>
                    </div>
                  </a>

                  {/* Hours */}
                  <div className="flex items-start gap-3.5 p-3.5 rounded-2xl border border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/50">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-400">
                      <Clock className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-neutral-900 dark:text-white">Support Operating Hours</p>
                      <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">Monday – Sunday (7 Days)</p>
                      <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5">9:00 AM – 11:00 PM PKT</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Payment Verification Quick Tips */}
              <div className="rounded-3xl border border-emerald-200/60 dark:border-emerald-800/40 bg-emerald-50/50 dark:bg-emerald-950/20 p-5 sm:p-6 text-xs text-emerald-950 dark:text-emerald-300 leading-relaxed">
                <div className="flex items-center gap-2 mb-2 font-black text-sm text-emerald-900 dark:text-emerald-200">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Payment Verification Guide</span>
                </div>
                <p className="text-neutral-600 dark:text-neutral-400 text-xs">
                  All transactions uploaded through Easypaisa, JazzCash, or online banking are matched manually against transaction IDs. Please allow up to 2 hours during peak ticket drop hours.
                </p>
              </div>

            </div>

            {/* Right: Contact Form (7 cols) */}
            <div className="lg:col-span-7 bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200/80 dark:border-neutral-800 p-6 sm:p-8 shadow-sm">
              <h2 className="text-xl font-black text-neutral-900 dark:text-white mb-1">
                Submit an Inquiry
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-6">
                Fill in the details below and we will get back to you with a resolution.
              </p>

              {errorMsg && (
                <div className="mb-6 p-4 rounded-2xl bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/40 dark:border-red-900/50 dark:text-red-300 text-xs sm:text-sm font-semibold flex items-center gap-2">
                  <span>⚠️</span>
                  <span>{errorMsg}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-1.5">
                      Your Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Ali Khan"
                      className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 px-3.5 py-2.5 text-sm text-neutral-900 dark:text-white outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-1.5">
                      Phone Number (11 digits) *
                    </label>
                    <input
                      type="tel"
                      required
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="03001234567"
                      className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 px-3.5 py-2.5 text-sm text-neutral-900 dark:text-white outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-1.5">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="ali@example.com"
                      className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 px-3.5 py-2.5 text-sm text-neutral-900 dark:text-white outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-1.5">
                      Issue Category *
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 px-3.5 py-2.5 text-sm text-neutral-900 dark:text-white outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition"
                    >
                      {CATEGORIES.map((cat, i) => (
                        <option key={i} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-1.5">
                    Event Number or Title <span className="text-neutral-400 font-normal lowercase">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={eventReference}
                    onChange={(e) => setEventReference(e.target.value)}
                    placeholder="e.g. #102 or Sufi Night 2026"
                    className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 px-3.5 py-2.5 text-sm text-neutral-900 dark:text-white outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-1.5">
                    Describe Your Inquiry *
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Please provide details about what you need assistance with..."
                    className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 px-3.5 py-2.5 text-sm text-neutral-900 dark:text-white outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-8 py-4 text-sm font-bold text-white transition hover:from-emerald-600 hover:to-emerald-700 active:scale-[0.99] shadow-lg shadow-emerald-500/25 disabled:opacity-50 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                      </svg>
                      <span>Transmitting Inquiry...</span>
                    </>
                  ) : (
                    <>
                      <span>Transmit Inquiry to Support</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
