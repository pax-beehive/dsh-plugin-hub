export function parseCatalogPage(value: string | undefined): number {
  return Math.max(Number.parseInt(value ?? "1", 10) || 1, 1);
}

// First/last page plus two neighbors around the current page, with nulls for
// collapsed gaps. Shared by the full catalog and category catalogs.
export function pageWindow(
  page: number,
  pageCount: number,
): Array<number | null> {
  const wanted = new Set([
    1,
    pageCount,
    page - 2,
    page - 1,
    page,
    page + 1,
    page + 2,
  ]);
  const pages = [...wanted]
    .filter((entry) => entry >= 1 && entry <= pageCount)
    .sort((a, b) => a - b);
  const windowed: Array<number | null> = [];
  let previous = 0;
  for (const entry of pages) {
    if (previous && entry - previous > 1) windowed.push(null);
    windowed.push(entry);
    previous = entry;
  }
  return windowed;
}
