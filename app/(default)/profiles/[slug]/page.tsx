import CopyCommand from "@/components/CopyCommand";
import HubHeader, { HubFooter } from "@/components/HubHeader";
import { hubCopy } from "@/lib/i18n";
import { getProfile } from "@/lib/hub-api";
import { getHubLocale } from "@/lib/i18n-server";
import { JsonLd, profileStructuredData } from "@/lib/structured-data";
import { pageMetadata } from "@/lib/page-metadata";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

async function loadProfile(slug: string) {
  return getProfile(slug);
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const profile = await loadProfile((await params).slug);
  if (!profile || profile.visibility === "private") return {};
  const locale = await getHubLocale();
  const latest = profile.versions.find((version) => version.version === profile.latestVersion) ?? profile.versions.at(-1)!;
  const title =
    locale === "en"
      ? `${latest.name} — DSH Profile for DeepSeek Harness`
      : `${latest.name} — DSH Profile（DeepSeek Harness 配置组合）`;
  const fallback =
    locale === "en"
      ? `Ordered, versioned DeepSeek Harness profile by ${profile.owner}. Apply it with one dsh-hub command to reproduce the same Harness setup.`
      : `由 ${profile.owner} 发布的有序、带版本的 DeepSeek Harness Profile，一条 dsh-hub 命令复现整套 Harness 配置。`;
  const description = latest.description || fallback;
  return pageMetadata({
    path: `/profiles/${profile.slug}`,
    title,
    description,
  });
}

export default async function ProfileDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const profile = await loadProfile((await params).slug);
  if (!profile || profile.visibility === "private") notFound();
  const locale = await getHubLocale();
  const t = hubCopy[locale];
  const latest = profile.versions.find((version) => version.version === profile.latestVersion) ?? profile.versions.at(-1)!;

  return (
    <main className="hub-shell">
      <JsonLd
        data={profileStructuredData({
          slug: profile.slug,
          name: latest.name,
          locale,
        })}
      />
      <HubHeader locale={locale} />
      <article className="profile-detail">
        <Link className="detail-back" href="/profiles">← Profiles</Link>
        <p className="catalog-eyebrow">PROFILE · {profile.owner}{profile.claimed ? ` · ${t.common.claimed}` : ""}</p>
        <h1>{latest.name}</h1>
        <p className="detail-summary">{latest.description}</p>
        <div className="profile-install-actions">
          <CopyCommand command={`dsh-hub profile apply ${profile.slug}`} locale={locale} profile={profile.slug} />
          <a className="profile-download-link" href={`/api/v1/profiles/${profile.slug}/releases/${latest.version}/download`}>
            {locale === "en" ? "Download .dshprofile" : "下载 .dshprofile"}
          </a>
        </div>
        <section className="profile-stack">
          <div className="profile-stack-heading"><h2>{t.profiles.loadOrder}</h2><span>{latest.bundles.length} bundles</span></div>
          {latest.bundles.map((bundle, index) => (
            <div className="profile-layer" key={`${bundle.packageName}-${index}`}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div><strong>{bundle.packageName}</strong><code>{bundle.selector}</code></div>
            </div>
          ))}
        </section>
        <dl className="profile-meta">
          <div><dt>{t.profiles.version}</dt><dd>{latest.version}</dd></div>
          <div><dt>{t.profiles.compatibility}</dt><dd>{latest.runtime?.version ?? latest.dsh}</dd></div>
          <div><dt>{t.profiles.patchCount}</dt><dd>{latest.patch.length}</dd></div>
          <div><dt>{locale === "en" ? "Composition" : "组合验证"}</dt><dd>{latest.verification?.composition === "locally_verified" ? (locale === "en" ? "Locally verified" : "已在本地验证") : (locale === "en" ? "Verified during install" : "安装时验证")}</dd></div>
          <div><dt>{locale === "en" ? "Activation" : "激活验证"}</dt><dd>{latest.verification?.activation === "locally_verified" ? (locale === "en" ? "Locally activated" : "已本地激活") : (locale === "en" ? "App-specific" : "由具体应用确认")}</dd></div>
        </dl>
        {latest.inputs.length ? <section className="profile-input-contract">
          <div className="profile-stack-heading"><h2>{locale === "en" ? "Required local inputs" : "所需本地输入"}</h2><span>{locale === "en" ? "values never uploaded" : "值不会上传"}</span></div>
          {latest.inputs.map((input) => <div key={input.key}><code>{input.key}</code><span>{input.label}{input.secret ? ` · ${locale === "en" ? "secret" : "敏感"}` : ""}</span></div>)}
        </section> : null}
        {latest.contentHash ? <p className="profile-content-hash"><span>CONTENT ID</span><code>{latest.contentHash}</code></p> : null}
      </article>
      <HubFooter locale={locale} />
    </main>
  );
}
