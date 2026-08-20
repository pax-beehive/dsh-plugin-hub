import {
  allSitemapEntries,
  buildSitemapShards,
  entriesForShard,
  listAllPackages,
  sitemapShardIds,
  staticSitemapEntries,
  type SitemapCategory,
  type SitemapProfile,
} from "@/lib/sitemap";
import type { MetadataRoute } from "next";

export const dynamic = "force-dynamic";

// hub-api is imported lazily: vinext eagerly evaluates metadata route modules
// when building the server entry, and hub-api statically imports
// `cloudflare:workers`, which breaks plain-Node render tests. Deferring keeps
// the entry chunk clean. If the Hub API is unreachable we still serve the
// static routes so the sitemap never 500s.
async function loadCatalog(): Promise<{
  plugins: Awaited<ReturnType<typeof listAllPackages>>;
  profiles: SitemapProfile[];
  categories: SitemapCategory[];
}> {
  const { listCategories, searchPackages, searchProfiles } = await import(
    "@/lib/hub-api"
  );
  const [plugins, profiles, categories] = await Promise.all([
    listAllPackages(searchPackages),
    searchProfiles("", 50),
    listCategories(50),
  ]);
  return { plugins, profiles, categories };
}

async function loadShards() {
  try {
    return buildSitemapShards(await loadCatalog());
  } catch {
    return buildSitemapShards({});
  }
}

export async function generateSitemaps() {
  return sitemapShardIds(await loadShards());
}

export default async function sitemap(props?: {
  id?: number | string;
}): Promise<MetadataRoute.Sitemap> {
  const shards = await loadShards();
  if (props?.id === undefined) {
    return allSitemapEntries(shards);
  }
  const id = Number(props.id);
  if (!Number.isFinite(id)) return staticSitemapEntries();
  return entriesForShard(shards, id);
}
