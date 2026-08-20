import { guides } from "./guides.ts";
import { absoluteUrl, SITE_HOME } from "./site-url.ts";
import type { MetadataRoute } from "next";

export const SITEMAP_CHUNK_SIZE = 2000;
export const SITEMAP_PAGE_SIZE = 50;
export const SITEMAP_MAX_PAGES = 500;

export type SitemapPackage = {
  slug: string;
  updatedAt?: string;
};

export type SitemapProfile = {
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
  items: SitemapPackage[];
  nextCursor: string | null;
  total?: number;
}>;

export function staticSitemapEntries(): MetadataRoute.Sitemap {
  return [
    { url: SITE_HOME, changeFrequency: "weekly", priority: 1 },
    { url: absoluteUrl("/plugins"), changeFrequency: "hourly", priority: 0.9 },
    { url: absoluteUrl("/profiles"), changeFrequency: "hourly", priority: 0.8 },
    { url: absoluteUrl("/status"), changeFrequency: "hourly", priority: 0.4 },
    { url: absoluteUrl("/guides"), changeFrequency: "weekly", priority: 0.6 },
    { url: absoluteUrl("/privacy"), changeFrequency: "yearly", priority: 0.2 },
    ...guides.map((guide) => ({
      url: absoluteUrl(`/guides/${guide.slug}`),
      changeFrequency: "weekly" as const,
      priority: 0.5,
    })),
  ];
}

// Walk the same catalog search the /plugins page uses. Prefer numbered pages
// (the live API returns `total` and ignores a broken cursor). Fall back to
// nextCursor when that is what the backend provides. Never invent slugs.
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
    for (const item of result.items) {
      if (!item.slug || seen.has(item.slug)) continue;
      seen.add(item.slug);
      items.push(item);
      added += 1;
    }

    if (result.items.length === 0 || added === 0) break;
    if (typeof result.total === "number" && items.length >= result.total) break;

    if (result.nextCursor) {
      cursor = result.nextCursor;
      page += 1;
      continue;
    }

    cursor = undefined;
    if (result.items.length < SITEMAP_PAGE_SIZE) break;
    page += 1;
  }

  return items;
}

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

export function profileSitemapEntries(
  profiles: SitemapProfile[],
): MetadataRoute.Sitemap {
  return profiles.map((profile) => ({
    url: absoluteUrl(`/profiles/${profile.slug}`),
    lastModified: profile.updatedAt,
    changeFrequency: "daily" as const,
    priority: 0.6,
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
  profiles?: SitemapProfile[];
  categories?: SitemapCategory[];
}): SitemapShards {
  const staticEntries = [
    ...staticSitemapEntries(),
    ...profileSitemapEntries(input.profiles ?? []),
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
