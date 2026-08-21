import HubHeader from "@/components/HubHeader";
import PluginIcon from "@/components/PluginIcon";
import { listCategories, searchPackages } from "@/lib/hub-api";
import { hubCopy, localeTags } from "@/lib/i18n";
import { getHubLocale } from "@/lib/i18n-server";
import { JsonLd, categoryStructuredData } from "@/lib/structured-data";
import { pageMetadata } from "@/lib/page-metadata";
import type { Metadata } from "next";
import Link from "next/link";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const category = decodeURIComponent((await params).category).slice(0, 60);
  const locale = await getHubLocale();
  const title =
    locale === "en"
      ? `${category} DSH Plugins — DeepSeek Harness Plugin Hub`
      : `${category} 类 DSH 插件 — DeepSeek Harness Plugin Hub`;
  const description =
    locale === "en"
      ? `Browse verified ${category} plugins for DeepSeek Harness (dsh): exact versions, compatibility, and one-command installs.`
      : `浏览经过校验的 DeepSeek Harness（dsh）${category}类插件：精确版本、兼容范围与一键安装命令。`;
  return pageMetadata({
    path: `/categories/${encodeURIComponent(category)}`,
    title,
    description,
  });
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const category = decodeURIComponent((await params).category).slice(0, 60);
  const locale = await getHubLocale();
  const t = hubCopy[locale];
  // category is a passthrough param; backends without category filtering
  // return the unfiltered list, which is still a reasonable page.
  const [result, categories] = await Promise.all([
    searchPackages("", { category, limit: 60 }),
    listCategories(50),
  ]);
  const items = result.items;

  return (
    <main className="hub-shell">
      <JsonLd
        data={categoryStructuredData({ category, plugins: items, locale })}
      />
      <HubHeader locale={locale} />
      <section className="catalog-hero compact">
        <p className="catalog-eyebrow">CATEGORY</p>
        <h1>{t.plugins.categoryResult(category)}</h1>
        <p>{t.plugins.categoryIntro}</p>
        <nav className="category-rail" aria-label={t.plugins.allCategories}>
          {categories.map((entry) => (
            <Link
              aria-current={entry.name === category ? "page" : undefined}
              className={entry.name === category ? "active" : undefined}
              href={`/categories/${encodeURIComponent(entry.name)}`}
              key={entry.name}
              prefetch={false}
            >
              {entry.name}
              <span>{entry.count}</span>
            </Link>
          ))}
        </nav>
      </section>
      <section className="catalog-section" aria-label={t.plugins.categoryResult(category)}>
        <div className="catalog-section-heading">
          <h2>{t.plugins.all}</h2>
          <span>{t.plugins.count(items.length)}</span>
        </div>
        {items.length ? (
          <div className="plugin-grid">
            {items.map((plugin) => (
              <Link className="plugin-card" href={`/plugins/${plugin.slug}`} key={plugin.id} prefetch={false}>
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
                  {plugin.verified ? <span className="verified-badge" title="Verified">✓</span> : null}
                  {plugin.claimed ? <span className="claimed-badge">{t.common.claimed}</span> : null}
                </h3>
                <code>{plugin.packageName}</code>
                <p>{plugin.summary}</p>
                <div className="plugin-tags">
                  {plugin.categories.slice(0, 3).map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                  {plugin.github ? (
                    <span className="tag-signal" title={plugin.github.pushedAt ? `${t.plugins.lastPush}: ${new Date(plugin.github.pushedAt).toLocaleDateString(localeTags[locale])}` : undefined}>
                      ★ {plugin.github.stars}
                    </span>
                  ) : null}
                </div>
                <div className="plugin-card-meta">
                  <span>{t.plugins.updatedLabel} {new Date(plugin.updatedAt).toLocaleDateString(localeTags[locale])}</span>
                  {plugin.license ? <span>{plugin.license}</span> : null}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="catalog-empty">
            <h2>{t.plugins.categoryEmpty}</h2>
            <p>
              <Link href="/plugins">{t.plugins.all}</Link>
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
