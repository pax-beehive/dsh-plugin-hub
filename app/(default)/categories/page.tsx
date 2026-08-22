import HubHeader from "@/components/HubHeader";
import PluginIcon from "@/components/PluginIcon";
import { loadCategoryPreviews } from "@/lib/category-previews";
import {
  listCategories,
  searchPackages,
  type CategoryCount,
  type PackageSearchOptions,
  type PluginSummary,
} from "@/lib/hub-api";
import { hubCopy } from "@/lib/i18n";
import { getHubLocale } from "@/lib/i18n-server";
import { JsonLd, categoriesIndexStructuredData } from "@/lib/structured-data";
import { pageMetadata } from "@/lib/page-metadata";
import type { Metadata } from "next";
import Link from "next/link";

export const dynamic = "force-dynamic";

const PREVIEW_LIMIT = 3;

function categoryTitle(entry: CategoryCount, locale: "zh" | "en"): string {
  if (locale === "zh") {
    return entry.displayNameZh || entry.displayName || entry.name;
  }
  return entry.displayName || entry.name;
}

async function safeSearchPackages(
  query: string,
  options?: Pick<PackageSearchOptions, "locale" | "limit" | "category">,
): Promise<{ items: PluginSummary[]; nextCursor: string | null; total?: number }> {
  try {
    return await searchPackages(query, options);
  } catch {
    return { items: [], nextCursor: null };
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getHubLocale();
  const t = hubCopy[locale];
  const catalog = await safeSearchPackages("", { locale, limit: 1 });
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
    safeSearchPackages("", { locale, limit: 1 }),
  ]);
  // One source of truth: registry search `total`. Category counts sum lower
  // because uncategorized packages exist; do not substitute that sum.
  const total = catalog.total;
  const previews = await loadCategoryPreviews(categories, locale, PREVIEW_LIMIT);
  const heading = typeof total === "number" && total > 0 ? t.plugins.browseAll(total) : t.plugins.browseAllUnknown;

  return (
    <main className="hub-shell">
      <JsonLd
        data={categoriesIndexStructuredData({
          categories,
          total: total ?? 0,
          locale,
        })}
      />
      <HubHeader locale={locale} />
      <section className="catalog-hero compact">
        <p className="catalog-eyebrow">{t.plugins.browseAllEyebrow}</p>
        <h1>{heading}</h1>
        <p>{t.plugins.browseAllIntro}</p>
        {categories.length ? (
          <nav className="category-rail category-index-rail" aria-label={t.plugins.allCategories}>
            {categories.map((entry) => (
              <Link
                href={`/categories/${encodeURIComponent(entry.name)}`}
                key={entry.name}
                prefetch={false}
              >
                {categoryTitle(entry, locale)}
                <span>{entry.count}</span>
              </Link>
            ))}
          </nav>
        ) : null}
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
          <>
            <div className="category-directory-heading">
              <div>
                <h2>{t.plugins.allCategories}</h2>
                <span>{categories.length}</span>
              </div>
              <Link href="/plugins" prefetch={false}>
                {t.plugins.all} <span aria-hidden="true">→</span>
              </Link>
            </div>
            <div className="category-directory-grid">
              {categories.map((entry) => {
                const preview = previews.get(entry.name) ?? [];
                return (
                  <Link
                    className="category-directory-card"
                    href={`/categories/${encodeURIComponent(entry.name)}`}
                    key={entry.name}
                    prefetch={false}
                  >
                    <div className="category-directory-card-topline">
                      <span className="category-directory-mark" aria-hidden="true">#</span>
                      <span className="category-directory-count">{t.plugins.count(entry.count)}</span>
                    </div>
                    <h3>{categoryTitle(entry, locale)}</h3>
                    {preview.length ? (
                      <ul className="category-directory-preview">
                        {preview.map((plugin) => (
                          <li key={plugin.id}>
                            <PluginIcon
                              className="plugin-icon"
                              displayName={plugin.displayName}
                              iconUrl={plugin.iconUrl}
                            />
                            <span>
                              <strong>{plugin.displayName}</strong>
                              <small>{plugin.packageName}</small>
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="category-directory-empty">{t.plugins.categoryEmpty}</p>
                    )}
                    <span className="category-directory-cta">
                      {t.plugins.viewCategory} <span aria-hidden="true">→</span>
                    </span>
                  </Link>
                );
              })}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
