"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { uuidv7 } from "@/utils/uuid";
import { Sparkles, Building2, MapPin, Calendar, Users, FileText, CheckCircle2, ArrowRight } from "lucide-react";

const CITIES = ["Karachi", "Lahore", "Islamabad", "Rawalpindi", "Faisalabad", "Peshawar", "Multan", "Quetta"];
const CATEGORIES = [
  "Trips", 
  "Qawwali Nights", 
  "Concert", 
  "Music", 
  "Technology", 
  "Food", 
  "Business", 
  "Arts", 
  "Sports", 
  "University Fest", 
  "Workshop"
];

export default function BookEventPage() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{type: "error" | "success", text: string} | null>(null);

  const [formData, setFormData] = useState({
    organizer_name: "",
    organizer_contact: "",
    title: "",
    category: "",
    city: "",
    description: "",
    venue_name: "",
    start_date: "",
    expected_tickets: "",
    additional_notes: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    if (!formData.organizer_name || !formData.organizer_contact || !formData.title || !formData.category || !formData.city) {
      setMessage({ type: 'error', text: 'Please fill out all the required fields marked with *.' });
      setLoading(false);
      return;
    }
    
    const supabase = createClient();
    
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setMessage({ type: 'error', text: 'You must be logged in to request to host an event.' });
      setLoading(false);
      return;
    }

    const payload = {
      id: uuidv7(),
      user_id: session.user.id,
      organizer_name: formData.organizer_name,
      organizer_contact: formData.organizer_contact,
      title: formData.title,
      category: formData.category,
      city: formData.city,
      description: formData.description,
      venue_name: formData.venue_name,
      start_date: formData.start_date || null,
      expected_tickets: formData.expected_tickets ? parseInt(formData.expected_tickets) : null,
      additional_notes: formData.additional_notes,
      status: 'pending'
    };

    const { error } = await supabase.from('book_event_requests').insert([payload]);

    if (error) {
      setMessage({ type: "error", text: error.message });
    } else {
      setMessage({ 
        type: "success", 
        text: "Your event request has been received! Our community relations team will contact you within 24 hours to review your proposal and activate your organizer dashboard." 
      });
      setFormData({
        organizer_name: "",
        organizer_contact: "",
        title: "",
        category: "",
        city: "",
        description: "",
        venue_name: "",
        start_date: "",
        expected_tickets: "",
        additional_notes: "",
      });
      window.scrollTo({ top: 0, behavior: "smooth" }); 
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 px-4 py-10 sm:py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        
        {/* Hero Header */}
        <div className="text-center mb-10 sm:mb-14">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 mb-4 shadow-xs">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Event Ghar Organizer Network</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-black text-neutral-900 dark:text-white tracking-tight">
            Host Your Next Event
          </h1>
          <p className="mt-3 text-sm sm:text-base text-neutral-600 dark:text-neutral-400 max-w-2xl mx-auto leading-relaxed">
            Partner with Pakistan&apos;s leading event ticketing network. Get zero setup fees, verified attendee QR ticketing, live gate scanners, and real-time sales dashboards.
          </p>
        </div>

        {/* 3 Key Benefits Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
          <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-white/70 dark:bg-neutral-900/70 p-5 backdrop-blur-xs">
            <div className="h-10 w-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-3">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-bold text-neutral-900 dark:text-white">Instant QR Entry</h4>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
              Prevent duplicate passes with tamper-proof QR codes and our fast mobile gate scanner.
            </p>
          </div>

          <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-white/70 dark:bg-neutral-900/70 p-5 backdrop-blur-xs">
            <div className="h-10 w-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-3">
              <Users className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-bold text-neutral-900 dark:text-white">Live Attendee Hub</h4>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
              Real-time gate check-in counts, payment screenshot review desk, and attendee export tools.
            </p>
          </div>

          <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-white/70 dark:bg-neutral-900/70 p-5 backdrop-blur-xs">
            <div className="h-10 w-10 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-3">
              <Building2 className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-bold text-neutral-900 dark:text-white">Direct Pakistani Banks</h4>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
              Easypaisa, JazzCash, Meezan, and Alfalah support with seamless proof uploads.
            </p>
          </div>
        </div>

        {/* Success State */}
        {message?.type === 'success' ? (
          <div className="p-8 sm:p-12 rounded-3xl bg-white dark:bg-neutral-900 border border-emerald-200 dark:border-emerald-800/60 shadow-lg text-center animate-in fade-in duration-300">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 mb-6 shadow-sm">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h3 className="text-2xl font-black text-neutral-900 dark:text-white mb-2">Event Request Received!</h3>
            <p className="text-sm sm:text-base text-neutral-600 dark:text-neutral-400 max-w-lg mx-auto leading-relaxed mb-8">
              {message.text}
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link 
                href="/" 
                className="w-full sm:w-auto rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 px-6 py-3 text-xs font-bold transition hover:opacity-90"
              >
                Return to Events
              </Link>
              <Link 
                href="/my-account" 
                className="w-full sm:w-auto rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white px-6 py-3 text-xs font-bold transition hover:bg-neutral-50 dark:hover:bg-neutral-800"
              >
                Go to My Account
              </Link>
            </div>
          </div>
        ) : (
          <div className="rounded-3xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 sm:p-10 shadow-sm">
            
            {message && message.type === 'error' && (
              <div className="mb-8 p-4 rounded-2xl bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/40 dark:border-red-900/50 dark:text-red-300 text-xs sm:text-sm font-semibold flex items-center gap-2">
                <span>⚠️</span>
                <span>{message.text}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-8">
              
              {/* Section 1: Organizer Identity */}
              <div>
                <div className="flex items-center gap-2.5 pb-3 border-b border-neutral-100 dark:border-neutral-800 mb-5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 text-xs font-bold">
                    1
                  </span>
                  <h2 className="text-base font-bold text-neutral-900 dark:text-white">
                    Organizer Information
                  </h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-1.5">
                      Organizer / Organization Name *
                    </label>
                    <input 
                      type="text" 
                      name="organizer_name" 
                      value={formData.organizer_name} 
                      onChange={handleChange} 
                      required 
                      placeholder="e.g. ACM FAST Chapter or Echoes Productions" 
                      className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 px-3.5 py-2.5 text-sm text-neutral-900 dark:text-white outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition" 
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-1.5">
                      WhatsApp / Phone / Email *
                    </label>
                    <input 
                      type="text" 
                      name="organizer_contact" 
                      value={formData.organizer_contact} 
                      onChange={handleChange} 
                      required 
                      placeholder="03001234567 or contact@brand.com" 
                      className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 px-3.5 py-2.5 text-sm text-neutral-900 dark:text-white outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition" 
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Event Details */}
              <div>
                <div className="flex items-center gap-2.5 pb-3 border-b border-neutral-100 dark:border-neutral-800 mb-5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 text-xs font-bold">
                    2
                  </span>
                  <h2 className="text-base font-bold text-neutral-900 dark:text-white">
                    Event Concept & Scope
                  </h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-1.5">
                      Event Title *
                    </label>
                    <input 
                      type="text" 
                      name="title" 
                      value={formData.title} 
                      onChange={handleChange} 
                      required 
                      placeholder="e.g. Annual Sufi Night 2026 or FAST DevCon" 
                      className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 px-3.5 py-2.5 text-sm text-neutral-900 dark:text-white outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition" 
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-1.5">
                      Event Category *
                    </label>
                    <select 
                      name="category" 
                      value={formData.category} 
                      onChange={handleChange} 
                      required 
                      className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 px-3.5 py-2.5 text-sm text-neutral-900 dark:text-white outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition"
                    >
                      <option value="">Select a category</option>
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-1.5">
                      City *
                    </label>
                    <select 
                      name="city" 
                      value={formData.city} 
                      onChange={handleChange} 
                      required 
                      className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 px-3.5 py-2.5 text-sm text-neutral-900 dark:text-white outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition"
                    >
                      <option value="">Select a city</option>
                      {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-1.5">
                      Target Event Date
                    </label>
                    <input 
                      type="date" 
                      name="start_date" 
                      value={formData.start_date} 
                      onChange={handleChange} 
                      className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 px-3.5 py-2.5 text-sm text-neutral-900 dark:text-white outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition" 
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-1.5">
                      Expected Ticket Sales
                    </label>
                    <input 
                      type="number" 
                      name="expected_tickets" 
                      value={formData.expected_tickets} 
                      onChange={handleChange} 
                      placeholder="e.g. 500 attendees" 
                      className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 px-3.5 py-2.5 text-sm text-neutral-900 dark:text-white outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition" 
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-1.5">
                      Proposed Venue / Location
                    </label>
                    <input 
                      type="text" 
                      name="venue_name" 
                      value={formData.venue_name} 
                      onChange={handleChange} 
                      placeholder="e.g. FAST NUCES Main Auditorium, Arts Council Karachi, or Beach Luxury Hotel" 
                      className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 px-3.5 py-2.5 text-sm text-neutral-900 dark:text-white outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition" 
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-1.5">
                      Event Description & Highlights
                    </label>
                    <textarea 
                      name="description" 
                      value={formData.description} 
                      onChange={handleChange} 
                      rows={4} 
                      placeholder="Describe what the event will feature, performers, student privileges, and target audience..." 
                      className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 px-3.5 py-2.5 text-sm text-neutral-900 dark:text-white outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition"
                    ></textarea>
                  </div>
                </div>
              </div>

              {/* Section 3: Notes & Special Requests */}
              <div>
                <div className="flex items-center gap-2.5 pb-3 border-b border-neutral-100 dark:border-neutral-800 mb-5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 text-xs font-bold">
                    3
                  </span>
                  <h2 className="text-base font-bold text-neutral-900 dark:text-white">
                    Additional Requirements
                  </h2>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-1.5">
                    Special Inquiries / Payment Account Needs (Optional)
                  </label>
                  <textarea 
                    name="additional_notes" 
                    value={formData.additional_notes} 
                    onChange={handleChange} 
                    rows={2} 
                    placeholder="E.g., need student ID verification at checkout, multiple ticket tiers (VIP / Regular), custom gate scanners, etc." 
                    className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 px-3.5 py-2.5 text-sm text-neutral-900 dark:text-white outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition"
                  ></textarea>
                </div>
              </div>

              {/* Submit CTA */}
              <div className="pt-4 border-t border-neutral-100 dark:border-neutral-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                <span className="text-xs text-neutral-500 dark:text-neutral-400">
                  ⚡ All submissions are reviewed within 24 hours.
                </span>

                <button 
                  type="submit" 
                  disabled={loading}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-8 py-3.5 text-sm font-bold text-white transition hover:from-emerald-600 hover:to-emerald-700 active:scale-[0.99] shadow-lg shadow-emerald-500/25 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                      </svg>
                      <span>Submitting Proposal...</span>
                    </>
                  ) : (
                    <>
                      <span>Submit Event Proposal</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>

            </form>
          </div>
        )}

      </div>
    </div>
  );
}
