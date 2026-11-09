/**
 * Supabase returns at most 1,000 rows per request. This helper fetches a list in
 * pages of 1,000 until everything has been loaded, so long lists (bookings,
 * tickets) are never silently cut off.
 *
 * Usage - build the query for one page and return it:
 *   const { data, error } = await fetchAllRows((from, to) =>
 *     supabase.from("bookings").select("*").order("created_at", { ascending: false }).order("id").range(from, to)
 *   );
 * Always add a stable order (and "id" as a tie-breaker) so pages never overlap.
 */
const PAGE_SIZE = 1000;

export async function fetchAllRows<T = any>(
  buildPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<{ data: T[]; error: { message: string } | null }> {
  const all: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await buildPage(from, from + PAGE_SIZE - 1);
    if (error) return { data: all, error };
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE_SIZE) break;
  }
  return { data: all, error: null };
}
