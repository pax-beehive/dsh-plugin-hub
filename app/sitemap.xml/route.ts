import {
  sitemapIndexLocsForTotal,
  sitemapIndexToXml,
} from "@/lib/sitemap";

export const dynamic = "force-dynamic";

async function loadPackageTotal(): Promise<number | undefined> {
  try {
    const { searchSitemapPackages } = await import("@/lib/hub-api");
    const result = await searchSitemapPackages("", { limit: 1, page: 1 });
    return result.total ?? result.items.length;
  } catch {
    return undefined;
  }
}

export async function GET(): Promise<Response> {
  const xml = sitemapIndexToXml(
    sitemapIndexLocsForTotal(await loadPackageTotal()),
  );
  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
