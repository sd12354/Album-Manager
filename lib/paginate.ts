/**
 * Generic paginator for any Supabase select() that may exceed the project's
 * db-max-rows setting (default 1000). Loops range() calls in 1000-row pages
 * until a short page is returned. Use anywhere we need *all* rows for a
 * user/owner regardless of how large the catalogue grows.
 *
 * Usage:
 *   const albums = await fetchAllPages<Album>((from, to) =>
 *     supabase.from("albums")
 *       .select("*")
 *       .eq("user_id", ownerId)
 *       .order("title", { ascending: true })
 *       .range(from, to)
 *   );
 *
 * The builder must:
 *   - Apply the same .from / .select / .filter / .order on every call
 *   - End with .range(from, to) on the passed-through bounds
 *   - Return a thenable resolving to PostgREST's { data, error } shape
 */
type PageResult<T> = {
  data: T[] | null;
  error: { message: string } | null;
};

export async function fetchAllPages<T>(
  buildQuery: (from: number, to: number) => PromiseLike<PageResult<T>>,
  options: { pageSize?: number; maxRows?: number } = {}
): Promise<T[]> {
  const pageSize = options.pageSize ?? 1000;
  // Safety cap so a runaway loop can't OOM the server for a huge catalogue.
  const maxRows = options.maxRows ?? 100_000;

  const all: T[] = [];
  let from = 0;
  while (all.length < maxRows) {
    const to = from + pageSize - 1;
    const { data, error } = await buildQuery(from, to);
    if (error) {
      throw new Error(`Pagination failed at offset ${from}: ${error.message}`);
    }
    const rows = data ?? [];
    if (rows.length === 0) break;
    all.push(...rows);
    if (rows.length < pageSize) break; // last page
    from += pageSize;
  }
  return all;
}
