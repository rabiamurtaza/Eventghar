"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";

export default function AdminOrganizersPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchOrganizers() {
      const supabase = createClient();
      
      // Fetching all events to extract organizer details
      const { data, error } = await supabase
        .from('events')
        .select('organizer_name, organizer_contact, title, status, event_number')
        .not('organizer_name', 'is', null)
        .order('created_at', { ascending: false });
      
      if (data) {
        setEvents(data);
      }
      setLoading(false);
    }
    fetchOrganizers();
  }, []);

  if (loading) return <div className="p-8 text-neutral-500">Loading organizers...</div>;

  // Group events by organizer contact
  const organizersMap = new Map();
  events.forEach(evt => {
    const key = evt.organizer_contact || evt.organizer_name;
    if (!key) return;
    if (!organizersMap.has(key)) {
      organizersMap.set(key, {
        name: evt.organizer_name,
        contact: evt.organizer_contact,
        events: []
      });
    }
    organizersMap.get(key).events.push(evt);
  });

  const organizersList = Array.from(organizersMap.values());

  return (
    <div className="p-6 sm:p-10">
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold text-neutral-900 dark:text-white">Organizers List</h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          View all organizers and the events they are hosting.
        </p>
      </div>

      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-neutral-600 dark:text-neutral-400">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:border-neutral-800 dark:bg-neutral-950/50">
              <tr>
                <th className="px-6 py-4">Organizer Name</th>
                <th className="px-6 py-4">Contact Email/Phone</th>
                <th className="px-6 py-4">Events Hosted</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {organizersList.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-neutral-500">No organizers found.</td>
                </tr>
              ) : (
                organizersList.map((org, index) => (
                  <tr key={index} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition">
                    <td className="px-6 py-4 font-medium text-neutral-900 dark:text-white">
                      {org.name || 'Unknown'}
                    </td>
                    <td className="px-6 py-4">
                      {org.contact || 'N/A'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        {org.events.map((evt: any, i: number) => (
                          <div key={i} className="flex items-center gap-2">
                            <span className="text-neutral-900 dark:text-neutral-300 font-medium text-xs">• {evt.title} {evt.event_number ? `(#${evt.event_number})` : ''}</span>
                            <span className={`text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded ${evt.status === 'published' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'}`}>
                              {evt.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
