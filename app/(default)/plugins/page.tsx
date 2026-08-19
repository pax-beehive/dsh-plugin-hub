import HubHeader from "@/components/HubHeader";
import SubmitNpmPackageForm from "@/components/SubmitNpmPackageForm";
import { getDb } from "@/db";
import { D1RegistryStore } from "@/db/registry-store";
import { hubCopy } from "@/lib/i18n";
import { getHubLocale } from "@/lib/i18n-server";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function PluginsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const q = ((await searchParams).q ?? "").trim().slice(0, 120);
  const locale = await getHubLocale();
  const t = hubCopy[locale];
  const result = await new D1RegistryStore(getDb()).search({
    query: q,
    cursor: null,
    limit: 30,
  });

  return (
    <main className="hub-shell">
      <HubHeader locale={locale} />
      <section className="catalog-hero">
        <p className="catalog-eyebrow">COMMUNITY REGISTRY</p>
        <h1>{t.plugins.title}</h1>
        <p>{t.plugins.intro}</p>
        <form className="catalog-search" action="/plugins">
          <label className="sr-only" htmlFor="plugin-search">{t.plugins.searchLabel}</label>
          <input
            id="plugin-search"
            name="q"
            type="search"
            defaultValue={q}
            placeholder={t.plugins.searchPlaceholder}
          />
          <button type="submit">{t.common.search}</button>
        </form>
        <SubmitNpmPackageForm locale={locale} />
      </section>
      <section className="catalog-section" aria-label="Plugin results">
        <div className="catalog-section-heading">
          <h2>{q ? t.plugins.result(q) : t.plugins.all}</h2>
          <span>{t.plugins.count(result.items.length)}</span>
        </div>
        {result.items.length ? (
          <div className="plugin-grid">
            {result.items.map((plugin) => (
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
                  {plugin.categories.slice(0, 3).map((category) => (
                    <span key={category}>{category}</span>
                  ))}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="catalog-empty">
            <h2>{t.plugins.emptyTitle}</h2>
            <p>{t.plugins.emptyBody}</p>
            <Link href="/dashboard">{t.plugins.emptyAction}</Link>
          </div>
        )}
      </section>
    </main>
  );
}
