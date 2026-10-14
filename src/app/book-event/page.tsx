"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

const CITIES = ["Karachi", "Lahore", "Islamabad", "Rawalpindi", "Faisalabad"];
const CATEGORIES = ["Trips", "Qawwali Nights", "Concert", "Music", "Technology", "Food", "Business", "Arts", "Sports", "University Fest", "Workshop"];

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
      setMessage({ type: 'error', text: 'Please fill out all the required fields.' });
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
      setMessage({ type: "success", text: "Your event request has been sent! Our admin will contact you shortly to review the details." });
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
      window.scrollTo(0, 0); 
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-extrabold text-slate-900">
            Host an Event with Event Ghar
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Submit your event details below. Our team will review your request, get in touch with you, and help you publish and manage your event!
          </p>
        </div>

        {message?.type === 'success' ? (
          <div className="mb-8 p-8 rounded-2xl bg-white border border-green-200 shadow-sm text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 mb-4">
              <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Request Submitted</h3>
            <p className="text-slate-600">{message.text}</p>
          </div>
        ) : (
          <>
            {message && message.type === 'error' && (
              <div className="mb-8 p-4 rounded-xl text-sm font-medium border bg-red-50 text-red-600 border-red-200">
                {message.text}
              </div>
            )}

            {/* The Form */}
            <form onSubmit={handleSubmit} className="space-y-8 bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm">
              
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                
                <div className="sm:col-span-2">
                  <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2 mb-4">Organizer Details</h2>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Organizer / Company Name <span className="text-red-500">*</span></label>
                  <input type="text" name="organizer_name" value={formData.organizer_name} onChange={handleChange} required placeholder="e.g. Events Co." className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500" />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Contact Email / Phone <span className="text-red-500">*</span></label>
                  <input type="text" name="organizer_contact" value={formData.organizer_contact} onChange={handleChange} required placeholder="Phone number or Email" className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500" />
                </div>

                <div className="sm:col-span-2 mt-4">
                  <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2 mb-4">Event Details</h2>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Event Title <span className="text-red-500">*</span></label>
                  <input type="text" name="title" value={formData.title} onChange={handleChange} required placeholder="e.g. Neon Nights Concert 2024" className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500" />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Category <span className="text-red-500">*</span></label>
                  <select name="category" value={formData.category} onChange={handleChange} required className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500">
                    <option value="">Select a category</option>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">City <span className="text-red-500">*</span></label>
                  <select name="city" value={formData.city} onChange={handleChange} required className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500">
                    <option value="">Select a city</option>
                    {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Proposed Start Date</label>
                  <input type="date" name="start_date" value={formData.start_date} onChange={handleChange} className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Expected Ticket Sales</label>
                  <input type="number" name="expected_tickets" value={formData.expected_tickets} onChange={handleChange} placeholder="e.g. 500" className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500" />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Proposed Venue Name</label>
                  <input type="text" name="venue_name" value={formData.venue_name} onChange={handleChange} placeholder="e.g. Arts Council Karachi" className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500" />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Event Description</label>
                  <textarea name="description" value={formData.description} onChange={handleChange} rows={4} placeholder="Describe your event and what you are planning..." className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"></textarea>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Additional Notes (Optional)</label>
                  <textarea name="additional_notes" value={formData.additional_notes} onChange={handleChange} rows={2} placeholder="Any specific requirements or questions for our team?" className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"></textarea>
                </div>
                
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end">
                <button 
                  type="submit" 
                  disabled={loading}
                  className="rounded-xl bg-purple-700 px-8 py-3.5 text-base font-bold text-white transition hover:bg-purple-600 hover:-translate-y-0.5 active:translate-y-0 shadow-lg shadow-purple-700/30 disabled:opacity-50"
                >
                  {loading ? "Submitting..." : "Submit Event Request"}
                </button>
              </div>

            </form>
          </>
        )}
      </div>
    </div>
  );
}
