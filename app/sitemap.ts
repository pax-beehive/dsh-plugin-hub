import { guides } from "@/lib/guides";
import type { MetadataRoute } from "next";

export const dynamic = "force-dynamic";

const baseUrl = "https://dshpluginhub.ai";

// db is imported lazily: vinext eagerly evaluates metadata route modules when
// building the server entry, and a static `cloudflare:workers` import there
// breaks the plain-Node render tests. Deferring keeps the entry chunk clean.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { getDb } = await import("@/db");
  const { D1RegistryStore } = await import("@/db/registry-store");
  const store = new D1RegistryStore(getDb());
  const [plugins, profiles, categories] = await Promise.all([
    store.search({ query: "", cursor: null, limit: 100 }),
    store.listProfiles(50),
    store.listCategories(50),
  ]);

  return [
    { url: `${baseUrl}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${baseUrl}/plugins`, changeFrequency: "hourly", priority: 0.9 },
    { url: `${baseUrl}/profiles`, changeFrequency: "hourly", priority: 0.8 },
    { url: `${baseUrl}/status`, changeFrequency: "hourly", priority: 0.4 },
    { url: `${baseUrl}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${baseUrl}/report`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${baseUrl}/guides`, changeFrequency: "weekly", priority: 0.6 },
    ...guides.map((guide) => ({
      url: `${baseUrl}/guides/${guide.slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
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
}
