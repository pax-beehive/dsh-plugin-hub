import HubHeader from "@/components/HubHeader";
import { getDb } from "@/db";
import { D1RegistryStore } from "@/db/registry-store";
import { hubCopy, localeTags } from "@/lib/i18n";
import { getHubLocale } from "@/lib/i18n-server";
import type { Metadata } from "next";
import Link from "next/link";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const category = decodeURIComponent((await params).category).slice(0, 60);
  return {
    title: `${category} — DSH Plugin Hub`,
    description: `DeepSeek Harness plugins in the ${category} category.`,
  };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const category = decodeURIComponent((await params).category).slice(0, 60);
  const locale = await getHubLocale();
  const t = hubCopy[locale];
  const store = new D1RegistryStore(getDb());
  const [items, categories] = await Promise.all([
    store.listByCategory(category),
    store.listCategories(),
  ]);

  return (
    <main className="hub-shell">
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
              <Link className="plugin-card" href={`/plugins/${plugin.slug}`} key={plugin.id}>
                <div className="plugin-card-topline">
                  <span className="plugin-icon" aria-hidden="true">
                    {plugin.displayName.slice(0, 1).toUpperCase()}
                  </span>
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
