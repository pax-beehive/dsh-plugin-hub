import CopyCommand from "@/components/CopyCommand";
import HubHeader from "@/components/HubHeader";
import { hubCopy } from "@/lib/i18n";
import { getProfile } from "@/lib/hub-api";
import { getHubLocale } from "@/lib/i18n-server";
import { JsonLd, profileStructuredData } from "@/lib/structured-data";
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
  return {
    title,
    description,
    alternates: { canonical: `/profiles/${profile.slug}` },
    openGraph: { title, description, images: [] },
    twitter: { title, description, images: [] },
  };
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
        <CopyCommand command={`dsh-hub profile apply ${profile.slug}`} locale={locale} />
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
          <div><dt>{t.profiles.compatibility}</dt><dd>{latest.dsh}</dd></div>
          <div><dt>{t.profiles.patchCount}</dt><dd>{latest.patch.length}</dd></div>
        </dl>
      </article>
    </main>
  );
}
