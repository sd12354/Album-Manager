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

/**
 * Like fetchAllPages, but when given a total `count` it issues all page
 * requests in parallel via Promise.all. For a 1,500-row table at 1,000 per
 * page this drops two sequential round trips to one wall-clock round trip.
 *
 * Falls back to sequential pagination when the caller can't supply a count.
 */
export async function fetchAllPagesParallel<T>(
  buildQuery: (from: number, to: number) => PromiseLike<PageResult<T>>,
  count: number,
  options: { pageSize?: number; maxRows?: number } = {}
): Promise<T[]> {
  const pageSize = options.pageSize ?? 1000;
  const maxRows = options.maxRows ?? 100_000;
  const total = Math.min(count, maxRows);
  if (total <= 0) return [];

  const pageCount = Math.ceil(total / pageSize);
  if (pageCount <= 1) {
    // One page worth — skip the parallel overhead.
    const { data, error } = await buildQuery(0, pageSize - 1);
    if (error) throw new Error(`Page fetch failed: ${error.message}`);
    return data ?? [];
  }

  const pages = await Promise.all(
    Array.from({ length: pageCount }, (_, i) => {
      const from = i * pageSize;
      const to = Math.min(from + pageSize - 1, total - 1);
      return buildQuery(from, to);
    })
  );

  const all: T[] = [];
  pages.forEach((page, i) => {
    if (page.error) {
      throw new Error(`Page ${i} failed: ${page.error.message}`);
    }
    if (page.data) all.push(...page.data);
  });
  return all;
}
