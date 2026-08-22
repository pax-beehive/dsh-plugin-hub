import { guides } from "./guides.ts";
import { parseSitemapPackage } from "./registry-search-response.ts";
import { absoluteUrl, SITE_HOME } from "./site-url.ts";
import type { MetadataRoute } from "next";

export const SITEMAP_CHUNK_SIZE = 2000;
export const SITEMAP_PAGE_SIZE = 50;
export const SITEMAP_MAX_PAGES = 500;

export type SitemapPackage = {
  slug: string;
  updatedAt?: string;
};

export type SitemapCategory = {
  name: string;
};

export type PackageSearch = (
  query: string,
  options?: { limit?: number; page?: number; cursor?: string },
) => Promise<{
  items: unknown[];
  nextCursor: string | null;
  total?: number;
}>;

export function staticSitemapEntries(): MetadataRoute.Sitemap {
  return [
    { url: SITE_HOME, changeFrequency: "weekly", priority: 1 },
    { url: absoluteUrl("/plugins"), changeFrequency: "hourly", priority: 0.9 },
    { url: absoluteUrl("/profiles"), changeFrequency: "daily", priority: 0.8 },
    { url: absoluteUrl("/categories"), changeFrequency: "daily", priority: 0.7 },
    { url: absoluteUrl("/docs"), changeFrequency: "weekly", priority: 0.6 },
    { url: absoluteUrl("/privacy"), changeFrequency: "yearly", priority: 0.2 },
    ...guides.map((guide) => ({
      url: absoluteUrl(`/docs/${guide.slug}`),
      changeFrequency: "weekly" as const,
      priority: 0.5,
    })),
  ];
}

export async function listAllPackages(
  searchPackages: PackageSearch,
): Promise<SitemapPackage[]> {
  const items: SitemapPackage[] = [];
  const seen = new Set<string>();
  let page = 1;
  let cursor: string | undefined;

  for (let i = 0; i < SITEMAP_MAX_PAGES; i += 1) {
    const result = await searchPackages("", {
      limit: SITEMAP_PAGE_SIZE,
      page,
      ...(cursor ? { cursor } : {}),
    });

    let added = 0;
    for (const raw of result.items) {
      const item = parseSitemapPackage(raw);
      if (!item || seen.has(item.slug)) continue;
      seen.add(item.slug);
      items.push(item);
      added += 1;
    }

    const moreRemain =
      typeof result.total === "number" && items.length < result.total;

    // An empty/quarantined page must not abort the walk while `total` says
    // more catalog rows remain. Duplicate pages (API returned items, 0 new
    // slugs) still stop. Only treat a truly empty API page as EOF when we
    // are not still short of `total`.
    if (result.items.length === 0) {
      if (!moreRemain) break;
    } else if (added === 0) {
      break;
    }

    if (typeof result.total === "number" && items.length >= result.total) break;

    if (result.nextCursor) {
      cursor = result.nextCursor;
      page += 1;
      continue;
    }

    cursor = undefined;
    if (result.items.length < SITEMAP_PAGE_SIZE && !moreRemain) break;
    page += 1;
  }

  return items;
}

/** Alias used by the sitemap route so listing never depends on PluginSummary. */
export const listAllPackageSlugs = listAllPackages;

export function pluginSitemapEntries(
  plugins: SitemapPackage[],
): MetadataRoute.Sitemap {
  return plugins.map((plugin) => ({
    url: absoluteUrl(`/plugins/${plugin.slug}`),
    lastModified: plugin.updatedAt,
    changeFrequency: "daily" as const,
    priority: 0.7,
  }));
}

export function categorySitemapEntries(
  categories: SitemapCategory[],
): MetadataRoute.Sitemap {
  return categories.map((category) => ({
    url: absoluteUrl(`/categories/${encodeURIComponent(category.name)}`),
    changeFrequency: "daily" as const,
    priority: 0.5,
  }));
}

export type SitemapShards = {
  static: MetadataRoute.Sitemap;
  plugins: MetadataRoute.Sitemap[];
};

export function buildSitemapShards(input: {
  plugins?: SitemapPackage[];
  categories?: SitemapCategory[];
}): SitemapShards {
  const staticEntries = [
    ...staticSitemapEntries(),
    ...categorySitemapEntries(input.categories ?? []),
  ];
  const pluginEntries = pluginSitemapEntries(input.plugins ?? []);
  const pluginShards: MetadataRoute.Sitemap[] = [];
  for (let i = 0; i < pluginEntries.length; i += SITEMAP_CHUNK_SIZE) {
    pluginShards.push(pluginEntries.slice(i, i + SITEMAP_CHUNK_SIZE));
  }
  return { static: staticEntries, plugins: pluginShards };
}

export function sitemapShardIds(shards: SitemapShards): Array<{ id: number }> {
  return [
    { id: 0 },
    ...shards.plugins.map((_, index) => ({ id: index + 1 })),
  ];
}

export function entriesForShard(
  shards: SitemapShards,
  id: number,
): MetadataRoute.Sitemap {
  if (id === 0) return shards.static;
  return shards.plugins[id - 1] ?? [];
}

export function allSitemapEntries(shards: SitemapShards): MetadataRoute.Sitemap {
  return [...shards.static, ...shards.plugins.flat()];
}

export function sitemapIndexLocs(shards: SitemapShards): string[] {
  return sitemapShardIds(shards).map(({ id }) =>
    absoluteUrl(`/sitemap/${id}.xml`),
  );
}

export function sitemapPageCount(total: number | undefined): number {
  if (total === undefined || !Number.isFinite(total) || total <= 0) return 0;
  return Math.min(SITEMAP_MAX_PAGES, Math.ceil(total / SITEMAP_PAGE_SIZE));
}

export function sitemapIndexLocsForTotal(total: number | undefined): string[] {
  return Array.from({ length: sitemapPageCount(total) + 1 }, (_, id) =>
    absoluteUrl(`/sitemap/${id}.xml`),
  );
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function lastmodValue(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : value;
}

/** Turn MetadataRoute.Sitemap entries into a urlset Vinext cannot drop. */
export function sitemapEntriesToXml(entries: MetadataRoute.Sitemap): string {
  const urls = entries.map((entry) => {
    const lastmod = entry.lastModified
      ? `\n    <lastmod>${escapeXml(lastmodValue(entry.lastModified))}</lastmod>`
      : "";
    return `  <url>\n    <loc>${escapeXml(entry.url)}</loc>${lastmod}\n  </url>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
}

export function sitemapIndexToXml(locs: string[]): string {
  const sitemaps = locs.map(
    (loc) => `  <sitemap>\n    <loc>${escapeXml(loc)}</loc>\n  </sitemap>`,
  );
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemaps.join("\n")}\n</sitemapindex>\n`;
}
