import HubHeader from "@/components/HubHeader";
import { getDb } from "@/db";
import { D1RegistryStore } from "@/db/registry-store";
import { hubCopy } from "@/lib/i18n";
import { getHubLocale } from "@/lib/i18n-server";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ProfilesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = ((await searchParams).q ?? "").trim().slice(0, 120);
  const locale = await getHubLocale();
  const t = hubCopy[locale];
  const profiles = await new D1RegistryStore(getDb()).searchProfiles(q, 30);
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
              <Link className="profile-card" href={`/profiles/${profile.slug}`} key={profile.id}>
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
