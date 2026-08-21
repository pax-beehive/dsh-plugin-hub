import {
  allSitemapEntries,
  buildSitemapShards,
  listAllPackages,
  sitemapEntriesToXml,
  type SitemapCategory,
  type SitemapProfile,
} from "@/lib/sitemap";

export const dynamic = "force-dynamic";

// hub-api is imported lazily: vinext eagerly evaluates route modules when
// building the server entry, and hub-api statically imports
// `cloudflare:workers`, which breaks plain-Node render tests. Deferring keeps
// the entry chunk clean. If the Hub API is unreachable we still serve the
// static routes so the sitemap never 500s or 404s.
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

async function loadEntries() {
  try {
    return allSitemapEntries(buildSitemapShards(await loadCatalog()));
  } catch {
    return allSitemapEntries(buildSitemapShards({}));
  }
}

export async function GET(): Promise<Response> {
  const xml = sitemapEntriesToXml(await loadEntries());
  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
    },
  });
}
