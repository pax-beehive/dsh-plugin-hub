import LanguageSwitch from "@/components/LanguageSwitch";
import { guides } from "@/lib/guides";
import { getHubLocale } from "@/lib/i18n-server";
import { pageMetadata } from "@/lib/page-metadata";
import type { Metadata } from "next";
import Link from "next/link";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getHubLocale();
  return pageMetadata({
    path: "/guides",
    title:
      locale === "en"
        ? "Guides — DeepSeek Harness Plugin Hub"
        : "指南 — DeepSeek Harness Plugin Hub",
    description:
      locale === "en"
        ? "Troubleshooting guides and tutorials for DSH plugin development and usage."
        : "DSH 插件开发和使用的故障排查指南与教程。",
  });
}

export default async function GuidesPage() {
  const locale = await getHubLocale();
  const t =
    locale === "en"
      ? {
          eyebrow: "GUIDES",
          title: "Plugin guides & troubleshooting",
          intro:
            "Step-by-step guides for common plugin development and usage scenarios.",
        }
      : {
          eyebrow: "指南",
          title: "插件指南与故障排查",
          intro: "常见插件开发和使用场景的分步指南。",
        };

  return (
    <main className="preference-page legal-page">
      <article className="preference-card legal-card guides-card">
        <div className="preference-heading-row">
          <Link className="preference-brand" href="/">
            DeepSeek Harness <strong>Plugin Hub</strong>
          </Link>
          <LanguageSwitch locale={locale} />
        </div>
        <p className="preference-eyebrow">{t.eyebrow}</p>
        <h1>{t.title}</h1>
        <p className="preference-intro">{t.intro}</p>

        <div className="guides-list">
          {guides.map((guide) => (
            <Link
              key={guide.slug}
              href={`/guides/${guide.slug}`}
              className="guide-card"
            >
              <h2>{guide.title[locale]}</h2>
              <p>{guide.description[locale]}</p>
            </Link>
          ))}
        </div>
      </article>
    </main>
  );
}
