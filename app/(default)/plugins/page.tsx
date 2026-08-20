import HubHeader from "@/components/HubHeader";
import SubmitNpmPackageForm from "@/components/SubmitNpmPackageForm";
import {
  listCategories,
  listSourceOnlyListings,
  searchPackages,
} from "@/lib/hub-api";
import { hubCopy, localeTags } from "@/lib/i18n";
import { getHubLocale } from "@/lib/i18n-server";
import type { Metadata } from "next";
import Link from "next/link";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getHubLocale();
  const title =
    locale === "en"
      ? "DeepSeek Harness Plugins — Verified DSH Plugin Catalog"
      : "DeepSeek Harness 插件目录 — 经过校验的 DSH Plugins";
  const description =
    locale === "en"
      ? "Browse the verified catalog of DeepSeek Harness (dsh) plugins: exact versions, compatibility ranges, HMR behavior, sources, and one-command installs."
      : "浏览经过 manifest 校验的 DeepSeek Harness（dsh）插件目录：精确版本、兼容范围、HMR 行为、源码仓库与一键安装命令。";
  return {
    title,
    description,
    alternates: { canonical: "/plugins" },
    openGraph: { title, description },
    twitter: { title, description },
  };
}

const pageSize = 30;
const sortValues = ["popular", "updated", "name"] as const;
type Sort = (typeof sortValues)[number];

function parseSort(value: string | undefined): Sort {
  return sortValues.includes(value as Sort) ? (value as Sort) : "popular";
}

// Numbered pagination window: first/last page plus two neighbors around the
// current page, with ellipsis markers (null) for collapsed gaps.
function pageWindow(page: number, pageCount: number): Array<number | null> {
  const wanted = new Set([1, pageCount, page - 2, page - 1, page, page + 1, page + 2]);
  const pages = [...wanted]
    .filter((entry) => entry >= 1 && entry <= pageCount)
    .sort((a, b) => a - b);
  const windowed: Array<number | null> = [];
  let previous = 0;
  for (const entry of pages) {
    if (previous && entry - previous > 1) windowed.push(null);
    windowed.push(entry);
    previous = entry;
  }
  return windowed;
}

export default async function PluginsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; sort?: string }>;
}) {
  const params = await searchParams;
  const q = (params.q ?? "").trim().slice(0, 120);
  const sort = parseSort(params.sort);
  const requestedPage = Math.max(Number.parseInt(params.page ?? "1", 10) || 1, 1);
  const locale = await getHubLocale();
  const t = hubCopy[locale];
  const result = await searchPackages(q, {
    sort,
    page: requestedPage,
    limit: pageSize,
  });

  // Backends that support numbered pagination return `total`; older ones omit
  // it and ignore the page param, in which case we render a single page and
  // hide the pagination controls instead of risking empty out-of-range pages.
  const paginated = typeof result.total === "number";
  const pageCount = paginated
    ? Math.max(Math.ceil(result.total! / pageSize), 1)
    : 1;
  const page = paginated ? Math.min(requestedPage, pageCount) : 1;
  // Re-fetch only when the backend paginates and the requested page was
  // clamped out of range (e.g. stale links after delisting).
  const pageResult =
    paginated && page !== requestedPage
      ? await searchPackages(q, { sort, page, limit: pageSize })
      : result;

  const isFirstPage = page === 1;
  const [sourceOnly, categories] = await Promise.all([
    // Source-only and category rails belong to the first page only. Both
    // degrade to [] when the backend doesn't serve those endpoints yet.
    isFirstPage
      ? listSourceOnlyListings({ query: q || undefined, limit: 12 })
      : Promise.resolve([]),
    listCategories(12),
  ]);

  const pageHref = (target: { page?: number; sort?: Sort }) => {
    const search = new URLSearchParams();
    if (q) search.set("q", q);
    const targetSort = target.sort ?? sort;
    if (targetSort !== "popular") search.set("sort", targetSort);
    const targetPage = target.page ?? page;
    if (targetPage > 1) search.set("page", String(targetPage));
    const query = search.toString();
    return query ? `/plugins?${query}` : "/plugins";
  };

  const sortLabels: Record<Sort, string> = {
    popular: t.plugins.sortPopular,
    updated: t.plugins.sortUpdated,
    name: t.plugins.sortName,
  };

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
        {categories.length ? (
          <nav className="category-rail" aria-label={t.plugins.browseCategories}>
            {categories.map((entry) => (
              <Link
                href={`/categories/${encodeURIComponent(entry.name)}`}
                key={entry.name}
              >
                {entry.name}
                <span>{entry.count}</span>
              </Link>
            ))}
          </nav>
        ) : null}
      </section>
      <section className="catalog-section" aria-label="Plugin results">
        <div className="catalog-section-heading">
          <h2>{q ? t.plugins.result(q) : t.plugins.all}</h2>
          <span>
            {paginated
              ? t.plugins.totalCount(result.total!)
              : t.plugins.count(pageResult.items.length)}
          </span>
        </div>
        <nav className="sort-tabs" aria-label={t.plugins.sortLabel}>
          {sortValues.map((value) => (
            <Link
              aria-current={value === sort ? "true" : undefined}
              className={value === sort ? "active" : undefined}
              href={pageHref({ sort: value, page: 1 })}
              key={value}
            >
              {sortLabels[value]}
            </Link>
          ))}
        </nav>
        {pageResult.items.length ? (
          <div className="plugin-grid">
            {pageResult.items.map((plugin) => (
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
            <h2>{t.plugins.emptyTitle}</h2>
            <p>{t.plugins.emptyBody}</p>
            <Link href="/dashboard">{t.plugins.emptyAction}</Link>
          </div>
        )}
        {pageCount > 1 ? (
          <nav className="catalog-pagination" aria-label="Pagination">
            {page > 1 ? (
              <Link className="pagination-link" href={pageHref({ page: page - 1 })}>
                ← {t.plugins.prevPage}
              </Link>
            ) : null}
            {pageWindow(page, pageCount).map((entry, index) =>
              entry === null ? (
                <span className="pagination-ellipsis" key={`gap-${index}`}>…</span>
              ) : (
                <Link
                  aria-current={entry === page ? "page" : undefined}
                  className={`pagination-link pagination-number ${entry === page ? "active" : ""}`}
                  href={pageHref({ page: entry })}
                  key={entry}
                >
                  {entry}
                </Link>
              ),
            )}
            {page < pageCount ? (
              <Link className="pagination-link pagination-next" href={pageHref({ page: page + 1 })}>
                {t.plugins.nextPage} →
              </Link>
            ) : null}
          </nav>
        ) : null}
      </section>
      {sourceOnly.length ? (
        <section className="catalog-section source-only-section" aria-label={t.plugins.sourceOnlyTitle}>
          <div className="catalog-section-heading">
            <h2>{t.plugins.sourceOnlyTitle}</h2>
            <span>{t.plugins.count(sourceOnly.length)}</span>
          </div>
          <p className="source-only-intro">{t.plugins.sourceOnlyIntro}</p>
          <div className="plugin-grid">
            {sourceOnly.map((repo) => (
              <a
                className="plugin-card source-card"
                href={`https://github.com/${repo.fullName}`}
                key={repo.fullName}
                target="_blank"
                rel="noreferrer"
              >
                <div className="plugin-card-topline">
                  <span className="plugin-icon source-icon" aria-hidden="true">
                    {repo.fullName.split("/")[1]?.slice(0, 1).toUpperCase() ?? "G"}
                  </span>
                  <span className="plugin-version">★ {repo.stars}</span>
                </div>
                <h3>
                  {repo.fullName.split("/")[1] ?? repo.fullName}
                  <span className="source-badge">{t.plugins.sourceOnlyBadge}</span>
                </h3>
                <code>{repo.fullName}</code>
                <p>{repo.description}</p>
                <div className="plugin-tags">
                  {repo.language ? <span>{repo.language}</span> : null}
                  {repo.license ? <span>{repo.license}</span> : null}
                  <span>{t.plugins.sourceOnlyCta} ↗</span>
                </div>
              </a>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
