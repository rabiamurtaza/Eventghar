/**
 * Event Lifecycle & Inventory Utility
 * Standardizes event status calculation, deadline enforcement, and capacity checks.
 */

export interface EventLifecycle {
  status: 'ended' | 'sold_out' | 'sales_closed' | 'today' | 'upcoming';
  label: string;
  badgeBg: string;
  badgeText: string;
  canBook: boolean;
  reason?: string;
  remainingTickets: number | null;
  totalTickets: number | null;
  bookedTickets: number;
}

/** "20:30:00", "8:30 PM" -> hours and minutes of the day, or null if it cannot be read. */
function parseTimeOfDay(timeStr?: string | null): { hours: number; minutes: number } | null {
  if (!timeStr) return null;
  const cleanTime = timeStr.trim().toLowerCase();
  const isPM = cleanTime.includes('pm');
  const isAM = cleanTime.includes('am');
  const parts = cleanTime.replace(/[^\d:]/g, '').split(':');
  let h = parseInt(parts[0], 10);
  const m = parts.length >= 2 ? parseInt(parts[1], 10) : 0;
  if (isNaN(h)) return null;
  if (isPM && h < 12) h += 12;
  if (isAM && h === 12) h = 0;
  return {
    hours: Math.min(23, Math.max(0, h)),
    minutes: Math.min(59, Math.max(0, isNaN(m) ? 0 : m)),
  };
}

export function parseEventEndDateTime(
  startDateStr?: string | null,
  endDateStr?: string | null,
  endTimeStr?: string | null,
  startTimeStr?: string | null
): Date | null {
  const targetDateStr = endDateStr || startDateStr;
  if (!targetDateStr) return null;

  const dateOnly = targetDateStr.split('T')[0].split(' ')[0];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) {
    // If not standard YYYY-MM-DD, try standard Date parse
    const fallbackDate = new Date(targetDateStr);
    return isNaN(fallbackDate.getTime()) ? null : fallbackDate;
  }

  let hours = 23;
  let minutes = 59;
  const seconds = 59;

  const end = parseTimeOfDay(endTimeStr);
  if (end) {
    hours = end.hours;
    minutes = end.minutes;
  }

  const d = new Date(`${dateOnly}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`);
  if (isNaN(d.getTime())) return null;

  // Night events: an end time earlier than the start time (e.g. 8 PM to 2 AM) on the
  // same date means the event finishes after midnight, i.e. on the NEXT day.
  const start = parseTimeOfDay(startTimeStr);
  if (end && start) {
    const startDateOnly = (startDateStr || '').split('T')[0].split(' ')[0];
    const endsOnStartDate = !endDateStr || dateOnly === startDateOnly;
    const endsBeforeItStarts = end.hours * 60 + end.minutes < start.hours * 60 + start.minutes;
    if (endsOnStartDate && endsBeforeItStarts) {
      d.setDate(d.getDate() + 1);
    }
  }

  return d;
}

export function parseSalesDeadline(deadlineStr?: string | null): Date | null {
  if (!deadlineStr) return null;
  let formatted = deadlineStr.trim().replace(' ', 'T');
  if (!formatted.includes('T')) {
    formatted += 'T23:59:59';
  }
  const d = new Date(formatted);
  return isNaN(d.getTime()) ? null : d;
}

export function isEventToday(startDateStr?: string | null, endDateStr?: string | null): boolean {
  if (!startDateStr) return false;
  const now = new Date();
  const todayYMD = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const startYMD = startDateStr.split('T')[0].split(' ')[0];
  const endYMD = endDateStr ? endDateStr.split('T')[0].split(' ')[0] : startYMD;

  return todayYMD >= startYMD && todayYMD <= endYMD;
}

export function getEventLifecycle(
  event: {
    start_date?: string | null;
    end_date?: string | null;
    start_time?: string | null;
    end_time?: string | null;
    sales_deadline?: string | null;
    total_tickets?: number | string | null;
    status?: string | null;
    [key: string]: unknown;
  } | null | undefined,
  bookedTickets: number = 0
): EventLifecycle {
  if (!event) {
    return {
      status: 'ended',
      label: 'Unavailable',
      badgeBg: 'bg-neutral-500',
      badgeText: 'text-white',
      canBook: false,
      reason: 'Event details are unavailable.',
      remainingTickets: null,
      totalTickets: null,
      bookedTickets: 0,
    };
  }

  const now = new Date();
  const rawTotal = event.total_tickets !== null && event.total_tickets !== undefined ? Number(event.total_tickets) : null;
  const totalTickets = rawTotal !== null && !isNaN(rawTotal) && rawTotal > 0 ? rawTotal : null;
  const remainingTickets = totalTickets !== null ? Math.max(0, totalTickets - bookedTickets) : null;

  // 0. Check if draft / unpublished
  if (event.status && event.status.toLowerCase() !== 'published') {
    return {
      status: 'sales_closed',
      label: 'DRAFT',
      badgeBg: 'bg-neutral-600 dark:bg-neutral-700',
      badgeText: 'text-white',
      canBook: false,
      reason: 'This event is currently in draft mode and not accepting bookings.',
      remainingTickets,
      totalTickets,
      bookedTickets,
    };
  }

  // 1. Check if event has ended
  const endDateTime = parseEventEndDateTime(event.start_date, event.end_date, event.end_time, event.start_time);
  if (endDateTime && endDateTime.getTime() < now.getTime()) {
    return {
      status: 'ended',
      label: 'ENDED',
      badgeBg: 'bg-neutral-600 dark:bg-neutral-700',
      badgeText: 'text-white',
      canBook: false,
      reason: 'This event has already taken place.',
      remainingTickets,
      totalTickets,
      bookedTickets,
    };
  }

  // 2. Check if sold out
  if (totalTickets !== null && remainingTickets !== null && remainingTickets <= 0) {
    return {
      status: 'sold_out',
      label: 'SOLD OUT',
      badgeBg: 'bg-rose-600',
      badgeText: 'text-white',
      canBook: false,
      reason: 'All tickets for this event are completely sold out.',
      remainingTickets: 0,
      totalTickets,
      bookedTickets,
    };
  }

  // 3. Check if sales deadline has passed
  const deadline = parseSalesDeadline(event.sales_deadline);
  if (deadline && deadline.getTime() < now.getTime()) {
    return {
      status: 'sales_closed',
      label: 'SALES CLOSED',
      badgeBg: 'bg-amber-600',
      badgeText: 'text-white',
      canBook: false,
      reason: 'Ticket booking for this event has closed.',
      remainingTickets,
      totalTickets,
      bookedTickets,
    };
  }

  // 4. Happening Today
  if (isEventToday(event.start_date, event.end_date)) {
    return {
      status: 'today',
      label: 'LIVE / TODAY',
      badgeBg: 'bg-emerald-600',
      badgeText: 'text-white',
      canBook: true,
      remainingTickets,
      totalTickets,
      bookedTickets,
    };
  }

  // 5. Active & Upcoming
  return {
    status: 'upcoming',
    label: 'LIVE',
    badgeBg: 'bg-[#7a1fd1]',
    badgeText: 'text-white',
    canBook: true,
    remainingTickets,
    totalTickets,
    bookedTickets,
  };
}
