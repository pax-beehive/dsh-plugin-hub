import {
  SITEMAP_MAX_PAGES,
  SITEMAP_PAGE_SIZE,
  categorySitemapEntries,
  pluginSitemapEntries,
  sitemapEntriesToXml,
  staticSitemapEntries,
} from "@/lib/sitemap";

export const dynamic = "force-dynamic";

function parseShardId(path: string[]): number | null {
  if (path.length !== 1) return null;
  const match = /^(\d+)\.xml$/.exec(path[0] ?? "");
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isSafeInteger(id) && id >= 0 && id <= SITEMAP_MAX_PAGES
    ? id
    : null;
}

async function loadShard(id: number) {
  const { listCategories, searchSitemapPackages } = await import(
    "@/lib/hub-api"
  );
  if (id === 0) {
    return [
      ...staticSitemapEntries(),
      ...categorySitemapEntries(await listCategories(50)),
    ];
  }
  const result = await searchSitemapPackages("", {
    limit: SITEMAP_PAGE_SIZE,
    page: id,
  });
  return pluginSitemapEntries(result.items);
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  const id = parseShardId((await context.params).path);
  if (id === null) return new Response("Not found", { status: 404 });

  let entries;
  try {
    entries = await loadShard(id);
  } catch {
    entries = id === 0 ? staticSitemapEntries() : [];
  }

  return new Response(sitemapEntriesToXml(entries), {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
