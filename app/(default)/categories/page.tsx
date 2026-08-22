import HubHeader from "@/components/HubHeader";
import PluginIcon from "@/components/PluginIcon";
import PluginCardHeading from "@/components/PluginCardHeading";
import { altPackageHint } from "@/lib/catalog-display";
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

const PREVIEW_LIMIT = 4;

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
  const previews = new Map(
    await Promise.all(
      categories.map(async (entry) => {
        const preview = await safeSearchPackages("", {
          category: entry.name,
          limit: PREVIEW_LIMIT,
          locale,
        });
        return [entry.name, preview.items] as const;
      }),
    ),
  );
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
                      {categoryTitle(entry, locale)}
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
                        <PluginCardHeading
                          altHint={altPackageHint(preview, plugin)}
                          claimedLabel={t.common.claimed}
                          displayName={plugin.displayName}
                          packageName={plugin.packageName}
                          verified={plugin.verified}
                        />
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
