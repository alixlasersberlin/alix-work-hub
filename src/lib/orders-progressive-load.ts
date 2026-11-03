type PageResult<T> = { data: T[] | null; error: { message: string; code?: string } | null };

/** Small, sequential authenticated reads; retry only timeouts, never broaden access. */
export async function loadOrdersProgressively<T>(
  fetchPage: (from: number, to: number) => PromiseLike<PageResult<T>>,
  receivePage: (rows: T[]) => Promise<void> | void,
  isCurrent: () => boolean,
  start = 0,
  initialSize = 50,
): Promise<void> {
  let from = start;
  let size = initialSize;
  while (isCurrent()) {
    const { data, error } = await fetchPage(from, from + size - 1);
    if (!isCurrent()) return;
    if (error) {
      if ((error.code === '57014' || /statement timeout/i.test(error.message)) && size > 10) {
        size = Math.max(10, Math.floor(size / 2));
        continue;
      }
      throw new Error(error.message);
    }
    const rows = data ?? [];
    if (rows.length) await receivePage(rows);
    if (rows.length < size) return;
    from += rows.length;
    size = Math.min(100, size * 2);
  }
}