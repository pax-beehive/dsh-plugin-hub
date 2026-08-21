import type { PluginRecord } from "@dsh-plugin-hub/schemas";
import { SITE_ORIGIN, absoluteUrl } from "./site-url.ts";

// Structural minimum for catalog entries in ItemList structured data. Kept
// local so this module never imports hub-api (which pulls cloudflare:workers
// and breaks plain-Node render tests).
export type CatalogEntry = Pick<PluginRecord, "slug" | "displayName">;

const BASE_URL = SITE_ORIGIN;

type JsonLdObject = Record<string, unknown>;

// Escape `<` so author-controlled listing copy (summary, names) can never
// terminate the script element early.
function serialize(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export function JsonLd({
  data,
}: {
  data: JsonLdObject | JsonLdObject[];
}) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serialize(data) }}
    />
  );
}

export function breadcrumbList(
  items: Array<{ name: string; path: string }>,
): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function pluginStructuredData(input: {
  plugin: PluginRecord;
  locale: "zh" | "en";
}): JsonLdObject[] {
  const { plugin, locale } = input;
  const url = absoluteUrl(`/plugins/${plugin.slug}`);
  const category = plugin.categories[0];
  const breadcrumbs = breadcrumbList([
    { name: locale === "en" ? "Home" : "首页", path: "/" },
    { name: "Plugins", path: "/plugins" },
    ...(category
      ? [
          {
            name: category,
            path: `/categories/${encodeURIComponent(category)}`,
          },
        ]
      : []),
    { name: plugin.displayName, path: `/plugins/${plugin.slug}` },
  ]);
  const software: JsonLdObject = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "@id": url,
    name: plugin.displayName,
    alternateName: plugin.packageName,
    description: plugin.summary,
    url,
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Cross-platform",
    softwareVersion: plugin.latestVersion,
    dateModified: plugin.updatedAt,
    isPartOf: { "@id": `${BASE_URL}/#website` },
    // DSH plugins are installed through the dsh CLI; the install URL is the
    // listing itself, which carries the exact command.
    installUrl: url,
    codeRepository: `https://github.com/${plugin.repository}`,
    ...(plugin.license ? { license: plugin.license } : {}),
    ...(plugin.screenshots[0]
      ? { screenshot: plugin.screenshots[0].url }
      : {}),
    offers: {
      "@type": "Offer",
      price: 0,
      priceCurrency: "USD",
    },
  };
  return [software, breadcrumbs];
}

export function categoryStructuredData(input: {
  category: string;
  plugins: CatalogEntry[];
  locale: "zh" | "en";
}): JsonLdObject[] {
  const { category, plugins, locale } = input;
  const path = `/categories/${encodeURIComponent(category)}`;
  const collection: JsonLdObject = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": absoluteUrl(path),
    name:
      locale === "en"
        ? `${category} DSH Plugins`
        : `${category} 类 DSH 插件`,
    url: absoluteUrl(path),
    isPartOf: { "@id": `${BASE_URL}/#website` },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: plugins.length,
      itemListElement: plugins.slice(0, 50).map((plugin, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: plugin.displayName,
        url: absoluteUrl(`/plugins/${plugin.slug}`),
      })),
    },
  };
  const breadcrumbs = breadcrumbList([
    { name: locale === "en" ? "Home" : "首页", path: "/" },
    { name: "Plugins", path: "/plugins" },
    { name: category, path },
  ]);
  return [collection, breadcrumbs];
}

export function guideStructuredData(input: {
  slug: string;
  title: string;
  description: string;
  locale: "zh" | "en";
}): JsonLdObject[] {
  const { slug, title, description, locale } = input;
  const path = `/docs/${slug}`;
  const article: JsonLdObject = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    "@id": absoluteUrl(path),
    headline: title,
    description,
    inLanguage: locale === "en" ? "en" : "zh-CN",
    url: absoluteUrl(path),
    isPartOf: { "@id": `${BASE_URL}/#website` },
    author: {
      "@type": "Organization",
      name: "DeepSeek Harness Plugin Hub Community",
      url: BASE_URL,
    },
  };
  const breadcrumbs = breadcrumbList([
    { name: locale === "en" ? "Home" : "首页", path: "/" },
    { name: locale === "en" ? "Documentation" : "文档中心", path: "/docs" },
    { name: title, path },
  ]);
  return [article, breadcrumbs];
}

export function profileStructuredData(input: {
  slug: string;
  name: string;
  locale: "zh" | "en";
}): JsonLdObject[] {
  const { slug, name, locale } = input;
  return [
    breadcrumbList([
      { name: locale === "en" ? "Home" : "首页", path: "/" },
      { name: "Profiles", path: "/profiles" },
      { name, path: `/profiles/${slug}` },
    ]),
  ];
}
