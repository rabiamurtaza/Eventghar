const STORAGE_KEY = "reviewed_event_requests";

export function getReviewedRequestIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function isRequestReviewed(id: string, status?: string): boolean {
  if (status && status !== 'pending') return true;
  const reviewedIds = getReviewedRequestIds();
  return reviewedIds.includes(id);
}

export function markRequestAsReviewed(id: string) {
  if (typeof window === "undefined") return;
  try {
    const existing = getReviewedRequestIds();
    if (!existing.includes(id)) {
      existing.push(id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
      window.dispatchEvent(new Event("event-requests-updated"));
    }
  } catch {}
}

export function markAllRequestsAsReviewed(ids: string[]) {
  if (typeof window === "undefined") return;
  try {
    const existing = new Set(getReviewedRequestIds());
    ids.forEach(id => existing.add(id));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(existing)));
    window.dispatchEvent(new Event("event-requests-updated"));
  } catch {}
}

export function markRequestAsPending(id: string) {
  if (typeof window === "undefined") return;
  try {
    const existing = getReviewedRequestIds().filter(existingId => existingId !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
    window.dispatchEvent(new Event("event-requests-updated"));
  } catch {}
}
