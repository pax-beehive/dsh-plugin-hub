import CopyCommand from "@/components/CopyCommand";
import HubHeader from "@/components/HubHeader";
import { getDb } from "@/db";
import { D1RegistryStore } from "@/db/registry-store";
import { hubCopy } from "@/lib/i18n";
import { getHubLocale } from "@/lib/i18n-server";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

async function getProfile(slug: string) {
  return new D1RegistryStore(getDb()).findProfile(slug);
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const profile = await getProfile((await params).slug);
  if (!profile || profile.visibility === "private") return {};
  const latest = profile.versions.find((version) => version.version === profile.latestVersion) ?? profile.versions.at(-1)!;
  const title = `${latest.name} — DSH Profile`;
  const description = latest.description || `Ordered DSH profile by ${profile.owner}`;
  return {
    title,
    description,
    openGraph: { title, description, images: [] },
    twitter: { title, description, images: [] },
  };
}

export default async function ProfileDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const profile = await getProfile((await params).slug);
  if (!profile || profile.visibility === "private") notFound();
  const locale = await getHubLocale();
  const t = hubCopy[locale];
  const latest = profile.versions.find((version) => version.version === profile.latestVersion) ?? profile.versions.at(-1)!;

  return (
    <main className="hub-shell">
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
