import { guides } from "@/lib/guides";
import type { MetadataRoute } from "next";

export const dynamic = "force-dynamic";

const baseUrl = "https://dshpluginhub.ai";

// hub-api is imported lazily: vinext eagerly evaluates metadata route modules
// when building the server entry, and hub-api statically imports
// `cloudflare:workers`, which breaks plain-Node render tests. Deferring keeps
// the entry chunk clean. If the Hub API is unreachable we still serve the
// static routes so the sitemap never 500s.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${baseUrl}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${baseUrl}/plugins`, changeFrequency: "hourly", priority: 0.9 },
    { url: `${baseUrl}/profiles`, changeFrequency: "hourly", priority: 0.8 },
    { url: `${baseUrl}/status`, changeFrequency: "hourly", priority: 0.4 },
    { url: `${baseUrl}/guides`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${baseUrl}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${baseUrl}/report`, changeFrequency: "yearly", priority: 0.2 },
    ...guides.map((guide) => ({
      url: `${baseUrl}/guides/${guide.slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
  ];

  try {
    const { listCategories, searchPackages, searchProfiles } = await import(
      "@/lib/hub-api"
    );
    const [plugins, profiles, categories] = await Promise.all([
      searchPackages("", { limit: 100 }),
      searchProfiles("", 50),
      listCategories(50),
    ]);

    return [
      ...staticRoutes,
      ...plugins.items.map((plugin) => ({
        url: `${baseUrl}/plugins/${plugin.slug}`,
        lastModified: plugin.updatedAt,
        changeFrequency: "daily" as const,
        priority: 0.7,
      })),
      ...profiles.map((profile) => ({
        url: `${baseUrl}/profiles/${profile.slug}`,
        lastModified: profile.updatedAt,
        changeFrequency: "daily" as const,
        priority: 0.6,
      })),
      ...categories.map((category) => ({
        url: `${baseUrl}/categories/${encodeURIComponent(category.name)}`,
        changeFrequency: "daily" as const,
        priority: 0.5,
      })),
    ];
  } catch {
    return staticRoutes;
  }
}
