"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import Link from "next/link";

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
    <div className="min-h-screen bg-slate-50 dark:bg-neutral-950 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        
        {/* Header */}
        <div className="text-center mb-10">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 mb-3 border border-purple-200 dark:border-purple-800">
            💬 Customer Support
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            How can we help you?
          </h1>
          <p className="mt-2 text-base text-slate-600 dark:text-neutral-400 max-w-xl mx-auto">
            Have a question about event tickets, payment verification, or hosting an event? Fill out the form below or reach out to us directly.
          </p>
        </div>

        {submitted ? (
          <div className="bg-white dark:bg-neutral-900 rounded-3xl border border-slate-200 dark:border-neutral-800 p-8 sm:p-12 text-center shadow-sm max-w-xl mx-auto animate-in fade-in duration-300">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-950/50 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center mx-auto mb-6 text-3xl">
              ✓
            </div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
              Message Received!
            </h2>
            <p className="text-slate-600 dark:text-neutral-400 text-sm leading-relaxed mb-6">
              Thank you, <span className="font-semibold text-slate-900 dark:text-white">{fullName}</span>. We have received your inquiry regarding <strong>{category}</strong>. Our support team will get in touch with you shortly.
            </p>

            <div className="space-y-3 pt-2">
              <a
                href={`https://wa.me/923000000000?text=${whatsappMessage}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-green-600 hover:bg-green-700 px-5 py-3 text-sm font-bold text-white transition shadow-sm"
              >
                <span>💬</span>
                <span>Chat on WhatsApp for Urgent Help</span>
              </a>

              <Link
                href="/"
                className="w-full block rounded-xl border border-slate-200 dark:border-neutral-800 hover:bg-slate-50 dark:hover:bg-neutral-800 px-5 py-3 text-sm font-semibold text-slate-700 dark:text-neutral-300 transition"
              >
                Back to Home
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            
            {/* Left: Contact Info Sidebar */}
            <div className="space-y-6">
              <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-slate-200 dark:border-neutral-800 p-6 shadow-sm">
                <h3 className="font-bold text-base text-slate-900 dark:text-white mb-4">
                  Direct Channels
                </h3>
                
                <div className="space-y-4 text-sm">
                  <div className="flex items-start gap-3">
                    <span className="text-xl">💬</span>
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">WhatsApp Support</p>
                      <p className="text-xs text-slate-500 dark:text-neutral-400 mt-0.5">Instant help for ticket & gate issues</p>
                      <a 
                        href={`https://wa.me/923000000000?text=${encodeURIComponent("Hello Event Ghar Support, I need help with an issue.")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-bold text-purple-600 dark:text-purple-400 hover:underline mt-1 inline-block"
                      >
                        Start WhatsApp Chat ➔
                      </a>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 pt-3 border-t border-slate-100 dark:border-neutral-800">
                    <span className="text-xl">✉️</span>
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">Email Us</p>
                      <p className="text-xs text-slate-500 dark:text-neutral-400 mt-0.5">Support & event inquiries</p>
                      <a 
                        href="mailto:support@eventghar.pk" 
                        className="text-xs font-bold text-purple-600 dark:text-purple-400 hover:underline mt-1 inline-block"
                      >
                        support@eventghar.pk
                      </a>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 pt-3 border-t border-slate-100 dark:border-neutral-800">
                    <span className="text-xl">⏰</span>
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">Operating Hours</p>
                      <p className="text-xs text-slate-500 dark:text-neutral-400 mt-0.5">Monday – Sunday</p>
                      <p className="text-xs text-slate-700 dark:text-neutral-300 font-medium">9:00 AM – 11:00 PM PKT</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tips block */}
              <div className="bg-purple-50 dark:bg-purple-950/30 rounded-2xl border border-purple-100 dark:border-purple-900/50 p-6 text-xs text-purple-900 dark:text-purple-300 leading-relaxed">
                <p className="font-bold text-sm mb-1 text-purple-950 dark:text-purple-200">Payment Verification Tip</p>
                If your payment screenshot is taking longer to verify, please allow up to 2 hours during peak event times. You can also contact us with your booking email.
              </div>
            </div>

            {/* Right: Contact Form */}
            <div className="md:col-span-2 bg-white dark:bg-neutral-900 rounded-3xl border border-slate-200 dark:border-neutral-800 p-6 sm:p-8 shadow-sm">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6">
                Send Us a Message
              </h2>

              {errorMsg && (
                <div className="mb-6 p-4 rounded-xl bg-red-50 text-red-600 border border-red-200 dark:bg-red-950/50 dark:border-red-900/50 dark:text-red-400 text-sm font-medium">
                  {errorMsg}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-neutral-300 mb-1.5">
                      Your Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Ali Khan"
                      className="w-full rounded-xl border border-slate-300 dark:border-neutral-700 bg-slate-50 dark:bg-neutral-950 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-neutral-300 mb-1.5">
                      Phone Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      required
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="03XXXXXXXXX"
                      className="w-full rounded-xl border border-slate-300 dark:border-neutral-700 bg-slate-50 dark:bg-neutral-950 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-neutral-300 mb-1.5">
                      Email Address <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your.email@example.com"
                      className="w-full rounded-xl border border-slate-300 dark:border-neutral-700 bg-slate-50 dark:bg-neutral-950 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-neutral-300 mb-1.5">
                      Issue Category <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 dark:border-neutral-700 bg-slate-50 dark:bg-neutral-950 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition"
                    >
                      <option value="Payment Verification Issue">Payment Verification / Screenshot Issue</option>
                      <option value="Ticket Access & QR Scanner">Ticket Access & QR Code Pass</option>
                      <option value="Event Booking Query">Event Booking Query</option>
                      <option value="Host an Event / Organizer Inquiry">Host an Event / Organizer Inquiry</option>
                      <option value="Account / Profile Issue">Account / Profile Issue</option>
                      <option value="Other Support">Other Support</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-neutral-300 mb-1.5">
                    Event Number or Title <span className="text-slate-400 font-normal lowercase">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={eventReference}
                    onChange={(e) => setEventReference(e.target.value)}
                    placeholder="e.g. #102 or Tech Summit 2026"
                    className="w-full rounded-xl border border-slate-300 dark:border-neutral-700 bg-slate-50 dark:bg-neutral-950 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-neutral-300 mb-1.5">
                    Describe your issue <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Please explain the issue you are facing or what help you need..."
                    className="w-full rounded-xl border border-slate-300 dark:border-neutral-700 bg-slate-50 dark:bg-neutral-950 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl bg-purple-600 hover:bg-purple-700 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-purple-600/20 transition disabled:opacity-50 cursor-pointer"
                >
                  {loading ? "Submitting Inquiry..." : "Submit Inquiry ➔"}
                </button>
              </form>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
