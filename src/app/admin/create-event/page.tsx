"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

const CITIES = ["Karachi", "Lahore", "Islamabad", "Rawalpindi", "Faisalabad"];
const CATEGORIES = ["Trips", "Qawwali Nights", "Concert", "Music", "Technology", "Food", "Business", "Arts", "Sports", "University Fest", "Workshop"];

export default function AdminCreateEvent() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{type: "error" | "success", text: string} | null>(null);

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const [submitStatus, setSubmitStatus] = useState<'draft' | 'published'>('draft');
  const [organizers, setOrganizers] = useState<any[]>([]);

  const [ticketTiers, setTicketTiers] = useState([{ name: "Standard", price: "", total: "" }]);
  const [paymentAccounts, setPaymentAccounts] = useState([{ method: "jazzcash", account_title_number: "" }]);

  const addTicketTier = () => setTicketTiers([...ticketTiers, { name: "", price: "", total: "" }]);
  const updateTicketTier = (index: number, field: string, value: string) => {
    const newTiers = [...ticketTiers];
    newTiers[index] = { ...newTiers[index], [field]: value };
    setTicketTiers(newTiers);
  };
  const removeTicketTier = (index: number) => setTicketTiers(ticketTiers.filter((_, i) => i !== index));

  const addPaymentAccount = () => setPaymentAccounts([...paymentAccounts, { method: "jazzcash", account_title_number: "" }]);
  const updatePaymentAccount = (index: number, field: string, value: string) => {
    const newAccs = [...paymentAccounts];
    newAccs[index] = { ...newAccs[index], [field]: value };
    setPaymentAccounts(newAccs);
  };
  const removePaymentAccount = (index: number) => setPaymentAccounts(paymentAccounts.filter((_, i) => i !== index));

  const [formData, setFormData] = useState({
    title: "",
    category: "",
    city: "",
    image_url: "",
    description: "",
    start_date: "",
    end_date: "",
    doors_open_time: "",
    start_time: "",
    end_time: "",
    venue_name: "",
    google_maps_link: "",
    full_address: "",
    total_tickets: "",
    max_tickets_per_person: "",
    sales_deadline: "",
    is_student_only: false,
    university_name: "",
    payment_instructions: "",
    terms_conditions: "",
    organizer_id: "",
    organizer_name: "",
    organizer_contact: "",
    status: "draft"
  });

  // Fetch available organizers from database
  useEffect(() => {
    async function loadOrganizers() {
      const supabase = createClient();
      const { data, error } = await supabase.from('organizers').select('*');
      if (error) {
        console.error("Error loading organizers:", error.message);
      }
      if (data && data.length > 0) {
        const sorted = [...data].sort((a, b) =>
          (a.full_name || a.name || a.email || '').localeCompare(b.full_name || b.name || b.email || '')
        );
        setOrganizers(sorted);
      }
    }
    loadOrganizers();
  }, []);

  // Pre-fill form from URL query parameters (e.g. from Event Requests page)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const prefill: any = {};
      if (params.get("title")) prefill.title = params.get("title");
      if (params.get("city")) prefill.city = params.get("city");
      if (params.get("category")) prefill.category = params.get("category");
      if (params.get("venue_name")) prefill.venue_name = params.get("venue_name");
      if (params.get("start_date")) prefill.start_date = params.get("start_date");
      if (params.get("total_tickets")) prefill.total_tickets = params.get("total_tickets");
      if (params.get("description")) prefill.description = params.get("description");
      if (params.get("organizer_id")) prefill.organizer_id = params.get("organizer_id");
      if (params.get("organizer_name")) prefill.organizer_name = params.get("organizer_name");
      if (params.get("organizer_contact")) prefill.organizer_contact = params.get("organizer_contact");

      if (Object.keys(prefill).length > 0) {
        setFormData(prev => ({ ...prev, ...prefill }));
      }
    }
  }, []);

  const handleOrganizerSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = e.target.value;
    if (!selectedId) {
      setFormData(prev => ({ ...prev, organizer_id: "" }));
      return;
    }
    const selectedOrg = organizers.find(o => o.id === selectedId);
    setFormData(prev => ({
      ...prev,
      organizer_id: selectedId,
      organizer_name: selectedOrg ? (selectedOrg.full_name || selectedOrg.name || prev.organizer_name) : prev.organizer_name,
      organizer_contact: selectedOrg ? (selectedOrg.email || selectedOrg.phone_number || prev.organizer_contact) : prev.organizer_contact,
    }));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    // 1. COMPULSORY FIELD VALIDATION
    if (!formData.title || !formData.category || !formData.start_date || !formData.venue_name || !formData.city) {
      setMessage({ type: 'error', text: 'Please fill out all important fields (Title, Category, Start Date, Venue, and City).' });
      setLoading(false);
      return;
    }
    
    const supabase = createClient();
    
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setMessage({ type: 'error', text: 'You must be logged in to create an event.' });
      setLoading(false);
      return;
    }

    // 2. IMAGE UPLOAD
    let finalImageUrl = formData.image_url;
    let uploadedFileName = null; // We track this so we can delete it if the DB fails

    if (imageFile) {
      const fileExt = imageFile.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('event-images')
        .upload(fileName, imageFile);

      if (uploadError) {
        setMessage({ type: 'error', text: 'Image upload failed: ' + uploadError.message });
        setLoading(false);
        return;
      }

      uploadedFileName = fileName;

      const { data: publicUrlData } = supabase.storage
        .from('event-images')
        .getPublicUrl(fileName);

      finalImageUrl = publicUrlData.publicUrl;
    }

    // 3. DATABASE INSERT
    const payload: any = {
      title: formData.title,
      category: formData.category,
      city: formData.city,
      description: formData.description,
      venue_name: formData.venue_name,
      google_maps_link: formData.google_maps_link,
      full_address: formData.full_address,
      university_name: formData.university_name,
      payment_instructions: formData.payment_instructions,
      terms_conditions: formData.terms_conditions,
      organizer_id: formData.organizer_id || null,
      organizer_name: formData.organizer_name,
      organizer_contact: formData.organizer_contact,
      total_tickets: formData.total_tickets ? parseInt(formData.total_tickets) : null,
      max_tickets_per_person: formData.is_student_only ? 1 : (formData.max_tickets_per_person ? parseInt(formData.max_tickets_per_person) : null),
      start_date: formData.start_date || null,
      end_date: formData.end_date || null,
      sales_deadline: formData.sales_deadline || null,
      doors_open_time: formData.doors_open_time || null,
      start_time: formData.start_time || null,
      end_time: formData.end_time || null,
      image_url: finalImageUrl,
      payment_accounts: paymentAccounts,
      ticket_price: JSON.stringify(ticketTiers),
      status: submitStatus,
      is_student_only: formData.is_student_only,
    };

    const { data: newEvent, error } = await supabase.from('events').insert([payload]).select().single();

    // 4. CLEANUP ON FAILURE OR SUCCESSFUL TICKET INSERTION
    if (error || !newEvent) {
      // If the database fails, delete the image uploaded so we don't have orphaned files
      if (uploadedFileName) {
        await supabase.storage.from('event-images').remove([uploadedFileName]);
      }
      setMessage({ type: "error", text: error?.message || "Failed to create event." });
    } else {
      // Insert Ticket Types into ticket_types table
      const validTiers = ticketTiers.filter(tier => tier.name || tier.price || tier.total);
      if (validTiers.length > 0) {
        const ticketsToInsert = validTiers.map(tier => ({
           event_id: newEvent.id,
           name: tier.name || 'Standard',
           price: tier.price ? parseFloat(tier.price) : 0,
           total_available: tier.total ? parseInt(tier.total) : null,
        }));
        
        const { error: ticketError } = await supabase.from('ticket_types').insert(ticketsToInsert);
        
        if (ticketError) {
           setMessage({ type: "error", text: `Event #${newEvent.event_number || newEvent.id} created, but failed to save ticket tiers: ` + ticketError.message });
        } else {
           setMessage({ type: "success", text: `Event #${newEvent.event_number || newEvent.id} ("${newEvent.title}") and ticket tiers successfully saved!` });
           window.scrollTo(0, 0); 
        }
      } else {
        setMessage({ type: "success", text: `Event #${newEvent.event_number || newEvent.id} ("${newEvent.title}") successfully saved!` });
        window.scrollTo(0, 0);
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        
        {/* Header */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-800 dark:bg-red-900/30 dark:text-red-400 mb-2 border border-red-200 dark:border-red-800/30">
              Admin Only Access
            </span>
            <h1 className="text-3xl font-extrabold text-neutral-900 dark:text-white">
              Create New Event
            </h1>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              Enter event details provided by organizers. All fields are optional.
            </p>
          </div>
        </div>

        {message && (
          <div className={`mb-8 p-4 rounded-xl text-sm font-medium border ${message.type === 'error' ? 'bg-red-50 text-red-600 border-red-200 dark:bg-red-950/50 dark:border-red-900/50 dark:text-red-400' : 'bg-green-50 text-green-600 border-green-200 dark:bg-green-950/50 dark:border-green-900/50 dark:text-green-400'}`}>
            {message.text}
          </div>
        )}

        {/* The Form */}
        <form onSubmit={handleSubmit} className="space-y-8">
          
          {/* Section 1: Basic Info */}
          <div className="bg-white dark:bg-neutral-900 p-6 sm:p-8 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
            <h2 className="text-lg font-bold text-neutral-900 dark:text-white mb-6 border-b border-neutral-100 dark:border-neutral-800 pb-2">1. Basic Information</h2>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Event Title <span className="text-red-500">*</span></label>
                <input type="text" name="title" value={formData.title} onChange={handleChange} required placeholder="e.g. Neon Nights Concert 2024" className="w-full rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white" />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Category</label>
                <select name="category" value={formData.category} onChange={handleChange} className="w-full rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white">
                  <option value="">Select a category</option>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">City</label>
                <select name="city" value={formData.city} onChange={handleChange} className="w-full rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white">
                  <option value="">Select a city</option>
                  {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Upload Event Image / Flyer</label>
                <input type="file" accept="image/*" onChange={handleImageChange} className="w-full rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100 dark:file:bg-green-900/30 dark:file:text-green-400" />
                {imagePreview && (
                  <div className="mt-4">
                    <img src={imagePreview} alt="Preview" className="h-48 w-auto rounded-lg object-cover shadow-sm border border-neutral-200 dark:border-neutral-700" />
                  </div>
                )}
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Description / Details</label>
                <textarea name="description" value={formData.description} onChange={handleChange} rows={5} placeholder="Describe the event, what to expect, who is performing..." className="w-full rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"></textarea>
                <p className="mt-1.5 text-xs text-neutral-500 dark:text-neutral-400">First line is the intro, then one line per heading like Heading: item, item, item.</p>
              </div>
            </div>
          </div>

          {/* Section 2: Dates & Times */}
          <div className="bg-white dark:bg-neutral-900 p-6 sm:p-8 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
            <h2 className="text-lg font-bold text-neutral-900 dark:text-white mb-6 border-b border-neutral-100 dark:border-neutral-800 pb-2">2. Dates & Times</h2>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Start Date</label>
                <input type="date" name="start_date" value={formData.start_date} onChange={handleChange} className="w-full rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">End Date (Optional)</label>
                <input type="date" name="end_date" value={formData.end_date} onChange={handleChange} className="w-full rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white" />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Doors Open Time</label>
                <input type="time" name="doors_open_time" value={formData.doors_open_time} onChange={handleChange} className="w-full rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white" />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Start Time</label>
                  <input type="time" name="start_time" value={formData.start_time} onChange={handleChange} className="w-full rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">End Time</label>
                  <input type="time" name="end_time" value={formData.end_time} onChange={handleChange} className="w-full rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white" />
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Location & Venue */}
          <div className="bg-white dark:bg-neutral-900 p-6 sm:p-8 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
            <h2 className="text-lg font-bold text-neutral-900 dark:text-white mb-6 border-b border-neutral-100 dark:border-neutral-800 pb-2">3. Location & Venue</h2>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Venue Name</label>
                <input type="text" name="venue_name" value={formData.venue_name} onChange={handleChange} placeholder="e.g. Arts Council Karachi" className="w-full rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Google Maps Link</label>
                <input type="url" name="google_maps_link" value={formData.google_maps_link} onChange={handleChange} placeholder="https://maps.google.com/..." className="w-full rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Full Address</label>
                <input type="text" name="full_address" value={formData.full_address} onChange={handleChange} placeholder="M.R. Kiyani Road, Karachi" className="w-full rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white" />
              </div>
            </div>
          </div>

          {/* Section 4: Ticketing & Capacity */}
          <div className="bg-white dark:bg-neutral-900 p-6 sm:p-8 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
            <h2 className="text-lg font-bold text-neutral-900 dark:text-white mb-6 border-b border-neutral-100 dark:border-neutral-800 pb-2">4. Ticketing & Capacity</h2>
            
            <div className="mb-8">
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-3">Ticket Types (Tiers)</label>
              <div className="space-y-4">
                {ticketTiers.map((tier, index) => (
                  <div key={index} className="flex flex-col sm:flex-row gap-4 p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 relative">
                    {ticketTiers.length > 1 && (
                      <button type="button" onClick={() => removeTicketTier(index)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600 shadow">✕</button>
                    )}
                    <div className="flex-1">
                      <label className="block text-xs font-semibold text-neutral-500 mb-1 uppercase tracking-wider">Ticket Name</label>
                      <input type="text" value={tier.name} onChange={(e) => updateTicketTier(index, 'name', e.target.value)} placeholder="e.g. Early Bird, VIP" className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-green-500 dark:border-neutral-700 dark:bg-black dark:text-white" />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs font-semibold text-neutral-500 mb-1 uppercase tracking-wider">Price (Rs.)</label>
                      <input type="number" value={tier.price} onChange={(e) => updateTicketTier(index, 'price', e.target.value)} placeholder="e.g. 1500 (0 for free)" className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-green-500 dark:border-neutral-700 dark:bg-black dark:text-white" />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs font-semibold text-neutral-500 mb-1 uppercase tracking-wider">Total Available</label>
                      <input type="number" value={tier.total} onChange={(e) => updateTicketTier(index, 'total', e.target.value)} placeholder="e.g. 100" className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-green-500 dark:border-neutral-700 dark:bg-black dark:text-white" />
                    </div>
                  </div>
                ))}
              </div>
              <button type="button" onClick={addTicketTier} className="mt-4 text-sm font-bold text-green-600 hover:text-green-500 flex items-center gap-1">
                + Add another ticket tier
              </button>
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 mt-6">
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Overall Event Capacity</label>
                <input type="number" name="total_tickets" value={formData.total_tickets} onChange={handleChange} placeholder="e.g. 500" className="w-full rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Max Tickets Per Person</label>
                <input type="number" name="max_tickets_per_person" value={formData.max_tickets_per_person} onChange={handleChange} placeholder="e.g. 4" disabled={formData.is_student_only} className="w-full rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white disabled:opacity-50" />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Ticket Sales Deadline</label>
                <input type="datetime-local" name="sales_deadline" value={formData.sales_deadline} onChange={handleChange} className="w-full rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white" />
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-neutral-100 dark:border-neutral-800">
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" name="is_student_only" checked={formData.is_student_only} onChange={(e) => setFormData(prev => ({...prev, is_student_only: e.target.checked}))} className="w-5 h-5 rounded border-neutral-300 text-green-500 focus:ring-green-500 dark:border-neutral-600 dark:bg-neutral-900" />
                <span className="text-sm font-medium text-neutral-900 dark:text-white">University Student Only Event</span>
              </label>
              
              {formData.is_student_only && (
                <div className="mt-4 pl-8">
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">University Name</label>
                  <input type="text" name="university_name" value={formData.university_name} onChange={handleChange} placeholder="e.g. FAST NUCES Karachi" className="w-full rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white" />
                </div>
              )}
            </div>
          </div>

          {/* Section 5: Payment Info */}
          <div className="bg-white dark:bg-neutral-900 p-6 sm:p-8 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
            <h2 className="text-lg font-bold text-neutral-900 dark:text-white mb-6 border-b border-neutral-100 dark:border-neutral-800 pb-2">5. Payment Information</h2>
            <div className="space-y-4">
              {paymentAccounts.map((acc, index) => (
                <div key={index} className="flex flex-col sm:flex-row gap-4 p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 relative">
                  {paymentAccounts.length > 1 && (
                    <button type="button" onClick={() => removePaymentAccount(index)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600 shadow">✕</button>
                  )}
                  <div className="flex-[1.5]">
                    <label className="block text-xs font-semibold text-neutral-500 mb-1 uppercase tracking-wider">Payment Method</label>
                    <select value={acc.method} onChange={(e) => updatePaymentAccount(index, 'method', e.target.value)} className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-green-500 dark:border-neutral-700 dark:bg-black dark:text-white">
                      <option value="jazzcash">JazzCash</option>
                      <option value="easypaisa">Easypaisa</option>
                      <option value="bank_transfer">Bank Transfer</option>
                      <option value="nayapay">NayaPay</option>
                      <option value="sadapay">SadaPay</option>
                    </select>
                  </div>
                  <div className="flex-[2.5]">
                    <label className="block text-xs font-semibold text-neutral-500 mb-1 uppercase tracking-wider">Account Title & Number</label>
                    <input type="text" value={acc.account_title_number} onChange={(e) => updatePaymentAccount(index, 'account_title_number', e.target.value)} placeholder="e.g. John Doe - 0300XXXXXXX" className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-green-500 dark:border-neutral-700 dark:bg-black dark:text-white" />
                  </div>
                </div>
              ))}
              <button type="button" onClick={addPaymentAccount} className="text-sm font-bold text-green-600 hover:text-green-500 flex items-center gap-1 mt-2 mb-4">
                + Add another payment account
              </button>
            </div>
            
            <div className="grid grid-cols-1 mt-6">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Payment Instructions for Buyers</label>
                <textarea name="payment_instructions" value={formData.payment_instructions} onChange={handleChange} rows={2} placeholder="e.g. Send exact amount and upload screenshot below..." className="w-full rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"></textarea>
              </div>
            </div>
          </div>

          {/* Section 6: Rules & Terms */}
          <div className="bg-white dark:bg-neutral-900 p-6 sm:p-8 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
            <h2 className="text-lg font-bold text-neutral-900 dark:text-white mb-6 border-b border-neutral-100 dark:border-neutral-800 pb-2">6. Rules & Terms</h2>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Event Terms & Conditions</label>
                <textarea name="terms_conditions" value={formData.terms_conditions} onChange={handleChange} rows={4} placeholder="Age limit, no-refund policy, what to bring, what's not allowed..." className="w-full rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"></textarea>
              </div>
            </div>
          </div>

          {/* Section 7: Organizer & Status (Admin Settings) */}
          <div className="bg-neutral-100 dark:bg-neutral-900 p-6 sm:p-8 rounded-2xl border border-neutral-300 dark:border-neutral-700 shadow-inner">
            <h2 className="text-lg font-bold text-neutral-900 dark:text-white mb-6 border-b border-neutral-300 dark:border-neutral-700 pb-2 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-neutral-500">
                <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
              </svg>
              7. Organizer Links & Status
            </h2>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
              <div className="sm:col-span-3">
                <label className="block text-sm font-bold text-neutral-900 dark:text-white mb-1">
                  Assign Organizer Account
                </label>
                <select
                  name="organizer_id"
                  value={formData.organizer_id}
                  onChange={handleOrganizerSelect}
                  className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 dark:border-neutral-600 dark:bg-black dark:text-white"
                >
                  <option value="">-- No Organizer Assigned (Admin Managed) --</option>
                  {organizers.map(org => (
                    <option key={org.id} value={org.id}>
                      {org.full_name || org.name || 'Unnamed Organizer'} ({org.email || org.phone_number || org.id}) {org.organizer_number ? `[#${org.organizer_number}]` : ''}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                  Selecting an organizer automatically grants them access to manage this event, view attendees, and scan QR tickets at <span className="text-indigo-600 dark:text-indigo-400 font-mono">/organizer/bookings</span>.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Organizer Name</label>
                <input type="text" name="organizer_name" value={formData.organizer_name} onChange={handleChange} placeholder="e.g. Events Co." className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 dark:border-neutral-600 dark:bg-black dark:text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Organizer Email / Contact</label>
                <input type="text" name="organizer_contact" value={formData.organizer_contact} onChange={handleChange} placeholder="contact@example.com" className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 dark:border-neutral-600 dark:bg-black dark:text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Event Status</label>
                <select name="status" value={formData.status} onChange={handleChange} className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-900 outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 dark:border-neutral-600 dark:bg-black dark:text-white">
                  <option value="draft">Draft (Hidden)</option>
                  <option value="published">Published (Live)</option>
                  <option value="sold_out">Sold Out</option>
                  <option value="ended">Ended</option>
                </select>
              </div>
              <div className="sm:col-span-3 text-xs text-neutral-500 dark:text-neutral-400 bg-white dark:bg-neutral-800 p-3 rounded-lg border border-neutral-200 dark:border-neutral-700">
                <span className="font-bold text-neutral-700 dark:text-neutral-300">Backend Logic (Hidden from Buyers):</span> 
                The unique <strong>Event ID</strong> and linked <strong>Organizer ID</strong> will be automatically generated and linked by Supabase when you click save, ensuring organizers only see screenshots and bookers for their own events.
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-end gap-4 pt-4 pb-12">
              <button 
                type="submit" 
                disabled={loading}
                onClick={() => setSubmitStatus("draft")}
                className="rounded-xl bg-neutral-200 px-8 py-3.5 text-base font-bold text-neutral-800 transition hover:bg-neutral-300 active:translate-y-0 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700 disabled:opacity-50"
              >
                {loading && submitStatus === "draft" ? "Saving..." : "Save as Draft"}
              </button>
              <button 
                type="submit" 
                disabled={loading}
                onClick={() => setSubmitStatus("published")}
                className="rounded-xl bg-green-500 px-8 py-3.5 text-base font-bold text-white transition hover:bg-green-600 hover:-translate-y-0.5 active:translate-y-0 shadow-lg shadow-green-500/30 disabled:opacity-50"
              >
                {loading && submitStatus === "published" ? "Publishing..." : "Publish Event"}
              </button>
            </div>

        </form>
      </div>
    </div>
  );
}
