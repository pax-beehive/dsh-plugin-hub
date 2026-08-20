import HubHeader, { HubFooter } from "@/components/HubHeader";
import PluginInstallCommand from "@/components/PluginInstallCommand";
import { hubCopy, localeTags } from "@/lib/i18n";
import { getPackageBySlug } from "@/lib/hub-api";
import { getHubLocale } from "@/lib/i18n-server";
import { JsonLd, pluginStructuredData } from "@/lib/structured-data";
import { pageMetadata } from "@/lib/page-metadata";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

async function getPlugin(slug: string) {
  return getPackageBySlug(slug);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const plugin = await getPlugin((await params).slug);
  if (!plugin) return {};
  const locale = await getHubLocale();
  const title =
    locale === "en"
      ? `${plugin.displayName} — DSH Plugin for DeepSeek Harness`
      : `${plugin.displayName} — DeepSeek Harness 插件（DSH Plugin）`;
  const installCommand = `dsh plugin --profile web add ${plugin.packageName}@${plugin.latestVersion}`;
  const description =
    locale === "en"
      ? `${plugin.summary} Install with: ${installCommand}. Verified manifest, exact versions and integrity on DSH Plugin Hub.`
      : `${plugin.summary} 安装命令：${installCommand}。DSH Plugin Hub 提供校验过的 manifest、精确版本与 integrity 元数据。`;
  const images = plugin.screenshots[0]
    ? [{ url: plugin.screenshots[0].url, alt: plugin.screenshots[0].alt }]
    : [];
  return pageMetadata({
    path: `/plugins/${plugin.slug}`,
    title,
    description,
    images,
  });
}

export default async function PluginDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const plugin = await getPlugin((await params).slug);
  if (!plugin) notFound();
  const locale = await getHubLocale();
  const t = hubCopy[locale];
  const latest = plugin.versions.find((version) => version.version === plugin.latestVersion) ?? plugin.versions.at(-1)!;
  const effectiveHmr = plugin.publisherMetadata.compatibility?.hmr ?? latest.compatibility.hmr;
  const effectiveDsh = plugin.publisherMetadata.compatibility?.dsh ?? latest.compatibility.dsh;
  const hmrLabel = t.plugins.hmr[effectiveHmr];
  const treeShaking = latest.manifest.sideEffects === false
    ? t.plugins.treeShaking.false
    : Array.isArray(latest.manifest.sideEffects)
      ? t.plugins.treeShaking.files
      : t.plugins.treeShaking.unknown;
  const packageSize = latest.unpackedSize === undefined
    ? t.common.unavailable
    : new Intl.NumberFormat(localeTags[locale], {
        style: "unit",
        unit: latest.unpackedSize >= 1_048_576 ? "megabyte" : "kilobyte",
        unitDisplay: "short",
        maximumFractionDigits: 1,
      }).format(
        latest.unpackedSize >= 1_048_576
          ? latest.unpackedSize / 1_048_576
          : latest.unpackedSize / 1024,
      );

  return (
    <main className="hub-shell">
      <JsonLd data={pluginStructuredData({ plugin, locale })} />
      <HubHeader locale={locale} />
      <article className="detail-layout">
        <section className="detail-main">
          <Link className="detail-back" href="/plugins">← Plugins</Link>
          <div className="detail-title-row">
            <span className="detail-icon" aria-hidden="true">
              {plugin.displayName.slice(0, 1).toUpperCase()}
            </span>
            <div>
              <p className="detail-package-name">{plugin.packageName}</p>
              <h1>
                {plugin.displayName}
                {plugin.verified ? <span className="verified-badge" title="Verified">✓</span> : null}
                {plugin.claimed ? <span className="claimed-badge">{t.common.claimed}</span> : null}
              </h1>
            </div>
          </div>
          <p className="detail-summary">{plugin.summary}</p>
          <PluginInstallCommand installSpec={latest.source.installSpec} locale={locale} />

          {plugin.screenshots.length ? (
            <div className="screenshot-grid">
              {plugin.screenshots.map((screenshot) => (
                // External publisher media is rendered without optimization.
                // eslint-disable-next-line @next/next/no-img-element
                <img key={screenshot.url} src={screenshot.url} alt={screenshot.alt} />
              ))}
            </div>
          ) : null}

          <section className="detail-description">
            <h2>{t.plugins.description}</h2>
            <p>{plugin.description || plugin.summary}</p>
          </section>

          <section className="version-list">
            <h2>{t.plugins.versions}</h2>
            {plugin.versions.slice().reverse().map((version) => (
              <div className="version-row" key={version.version}>
                <div>
                  <strong>{version.version}</strong>
                  <span>{version.channel}</span>
                </div>
                <time dateTime={version.publishedAt}>
                  {new Date(version.publishedAt).toLocaleDateString(localeTags[locale])}
                </time>
              </div>
            ))}
          </section>
        </section>

        <aside className="detail-sidebar">
          <dl>
            <div><dt>{t.plugins.latest}</dt><dd>{plugin.latestVersion}</dd></div>
            <div><dt>DSH</dt><dd>{effectiveDsh}</dd></div>
            <div><dt>HMR</dt><dd>{hmrLabel}</dd></div>
            <div><dt>Tree shaking</dt><dd>{treeShaking}</dd></div>
            <div><dt>{t.plugins.unpackedSize}</dt><dd>{packageSize}</dd></div>
            <div><dt>{t.plugins.fileCount}</dt><dd>{latest.fileCount ?? t.common.unavailable}</dd></div>
            <div><dt>Surface</dt><dd>{latest.compatibility.surfaces.join(", ")}</dd></div>
            <div><dt>{t.plugins.license}</dt><dd>{plugin.license ?? t.common.undeclared}</dd></div>
            <div><dt>{t.plugins.source}</dt><dd>{latest.source.kind}</dd></div>
            {plugin.github ? (
              <div><dt>GitHub</dt><dd>★ {plugin.github.stars}</dd></div>
            ) : null}
            {plugin.github?.pushedAt ? (
              <div>
                <dt>{t.plugins.lastPush}</dt>
                <dd>{new Date(plugin.github.pushedAt).toLocaleDateString(localeTags[locale])}</dd>
              </div>
            ) : null}
          </dl>
          <a href={`https://github.com/${plugin.repository}`} target="_blank" rel="noreferrer">
            {t.common.viewSource}
          </a>
          {plugin.homepage ? <a href={plugin.homepage} target="_blank" rel="noreferrer">{t.common.homepage}</a> : null}
          <Link href={`/report?package=${encodeURIComponent(plugin.packageName)}`} className="detail-report-link">
            {t.common.reportIssue}
          </Link>
        </aside>
      </article>
      <HubFooter locale={locale} />
    </main>
  );
}
