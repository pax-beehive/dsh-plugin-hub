import HubHeader from "@/components/HubHeader";
import PluginIcon from "@/components/PluginIcon";
import {
  listCategories,
  searchPackages,
  type CategoryCount,
  type PluginSummary,
} from "@/lib/hub-api";
import { hubCopy } from "@/lib/i18n";
import { getHubLocale } from "@/lib/i18n-server";
import { JsonLd, categoriesIndexStructuredData } from "@/lib/structured-data";
import { pageMetadata } from "@/lib/page-metadata";
import type { Metadata } from "next";
import Link from "next/link";

export const dynamic = "force-dynamic";

const PREVIEW_LIMIT = 4;

async function safeSearchPackages(
  query: string,
  options?: { limit?: number; category?: string },
): Promise<{ items: PluginSummary[]; nextCursor: string | null; total?: number }> {
  try {
    return await searchPackages(query, options);
  } catch {
    return { items: [], nextCursor: null };
  }
}

function previewByCategory(
  categories: CategoryCount[],
  plugins: PluginSummary[],
): Map<string, PluginSummary[]> {
  const map = new Map<string, PluginSummary[]>();
  for (const category of categories) {
    map.set(category.name, []);
  }
  for (const plugin of plugins) {
    for (const name of plugin.categories) {
      const list = map.get(name);
      if (!list || list.length >= PREVIEW_LIMIT) continue;
      list.push(plugin);
    }
  }
  return map;
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getHubLocale();
  const t = hubCopy[locale];
  const catalog = await safeSearchPackages("", { limit: 1 });
  const total = catalog.total ?? 0;
  const title = total > 0 ? t.plugins.browseAll(total) : t.plugins.browseAllUnknown;
  return pageMetadata({
    path: "/categories",
    title,
    description: t.plugins.browseAllDescription,
  });
}

export default async function CategoriesIndexPage() {
  const locale = await getHubLocale();
  const t = hubCopy[locale];
  const [categories, catalog] = await Promise.all([
    listCategories(50),
    safeSearchPackages("", { limit: 60 }),
  ]);
  const total =
    catalog.total ??
    (categories.length
      ? categories.reduce((sum, entry) => sum + entry.count, 0)
      : catalog.items.length);
  const previews = previewByCategory(categories, catalog.items);
  const heading = total > 0 ? t.plugins.browseAll(total) : t.plugins.browseAllUnknown;

  return (
    <main className="hub-shell">
      <JsonLd
        data={categoriesIndexStructuredData({
          categories,
          total,
          locale,
        })}
      />
      <HubHeader locale={locale} />
      <section className="catalog-hero compact">
        <p className="catalog-eyebrow">{t.plugins.browseAllEyebrow}</p>
        <h1>{heading}</h1>
        <p>{t.plugins.browseAllIntro}</p>
      </section>
      <section className="catalog-section" aria-label={t.plugins.allCategories}>
        {categories.length === 0 ? (
          <div className="catalog-empty">
            <h2>{t.plugins.browseAllLoading}</h2>
            <p>
              <Link href="/plugins" prefetch={false}>
                {t.plugins.all}
              </Link>
            </p>
          </div>
        ) : (
          categories.map((entry) => {
            const preview = previews.get(entry.name) ?? [];
            return (
              <section className="category-index-block" key={entry.name}>
                <div className="catalog-section-heading">
                  <h2>
                    <Link href={`/categories/${encodeURIComponent(entry.name)}`} prefetch={false}>
                      {entry.name}
                    </Link>
                  </h2>
                  <span>{t.plugins.count(entry.count)}</span>
                </div>
                {preview.length ? (
                  <div className="plugin-grid">
                    {preview.map((plugin) => (
                      <Link
                        className="plugin-card"
                        href={`/plugins/${plugin.slug}`}
                        key={plugin.id}
                        prefetch={false}
                      >
                        <div className="plugin-card-topline">
                          <PluginIcon
                            className="plugin-icon"
                            displayName={plugin.displayName}
                            iconUrl={plugin.iconUrl}
                          />
                          <span className="plugin-version">v{plugin.latestVersion}</span>
                        </div>
                        <h3>
                          {plugin.displayName}
                          {plugin.verified ? (
                            <span className="verified-badge" title="Verified">
                              {"\u2713"}
                            </span>
                          ) : null}
                        </h3>
                        <code>{plugin.packageName}</code>
                        <p>{plugin.summary}</p>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="catalog-empty">
                    <p>{t.plugins.categoryEmpty}</p>
                  </div>
                )}
                <p className="category-index-more">
                  <Link href={`/categories/${encodeURIComponent(entry.name)}`} prefetch={false}>
                    {t.plugins.viewCategory}
                  </Link>
                </p>
              </section>
            );
          })
        )}
      </section>
    </main>
  );
}
