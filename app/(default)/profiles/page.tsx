import HubHeader from "@/components/HubHeader";
import { hubCopy } from "@/lib/i18n";
import { searchProfiles } from "@/lib/hub-api";
import { getHubLocale } from "@/lib/i18n-server";
import { pageMetadata } from "@/lib/page-metadata";
import type { Metadata } from "next";
import Link from "next/link";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getHubLocale();
  const title =
    locale === "en"
      ? "DSH Profiles — Reusable DeepSeek Harness Configurations"
      : "DSH Profiles — 可复用的 DeepSeek Harness 配置组合";
  const description =
    locale === "en"
      ? "Ordered, versioned DeepSeek Harness profiles: locked plugin versions and load order, applied with one dsh-hub command to reproduce the same Harness setup."
      : "有序、带版本的 DeepSeek Harness Profile：锁定插件版本与加载顺序，一条 dsh-hub 命令在任何机器上复现同一套 Harness。";
  return pageMetadata({
    path: "/profiles",
    title,
    description,
  });
}

export default async function ProfilesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = ((await searchParams).q ?? "").trim().slice(0, 120);
  const locale = await getHubLocale();
  const t = hubCopy[locale];
  const profiles = await searchProfiles(q, 30);
  return (
    <main className="hub-shell">
      <HubHeader locale={locale} />
      <section className="catalog-hero compact">
        <p className="catalog-eyebrow">ORDERED CONFIGURATIONS</p>
        <h1>{t.profiles.title}</h1>
        <p>{t.profiles.intro}</p>
        <form className="catalog-search" action="/profiles">
          <label className="sr-only" htmlFor="profile-search">{t.profiles.searchLabel}</label>
          <input id="profile-search" name="q" type="search" defaultValue={q} placeholder={t.profiles.searchPlaceholder} />
          <button type="submit">{t.common.search}</button>
        </form>
      </section>
      <section className="catalog-section">
        <div className="catalog-section-heading"><h2>{t.profiles.public}</h2><span>{t.profiles.count(profiles.length)}</span></div>
        {profiles.length ? (
          <div className="profile-grid">
            {profiles.map((profile) => (
              <Link className="profile-card" href={`/profiles/${profile.slug}`} key={profile.id} prefetch={false}>
                <span className="profile-glyph" aria-hidden="true">◈</span>
                <div><h3>{profile.name}{profile.claimed ? <span className="claimed-badge">{t.common.claimed}</span> : null}</h3><p>{profile.description || `by ${profile.owner}`}</p></div>
                <code>{profile.bundleCount} bundles · v{profile.latestVersion}</code>
              </Link>
            ))}
          </div>
        ) : (
          <div className="catalog-empty"><h2>{t.profiles.emptyTitle}</h2><p>{t.profiles.emptyBody}</p></div>
        )}
      </section>
    </main>
  );
}
