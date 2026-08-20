import LanguageSwitch from "@/components/LanguageSwitch";
import { findGuide, guides } from "@/lib/guides";
import { getHubLocale } from "@/lib/i18n-server";
import { JsonLd, guideStructuredData } from "@/lib/structured-data";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

export function generateStaticParams() {
  return guides.map((guide) => ({ slug: guide.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const guide = findGuide(slug);
  if (!guide) return {};
  const locale = await getHubLocale();
  return {
    title: `${guide.title[locale]} — DSH Plugin Hub`,
    description: guide.description[locale],
    alternates: { canonical: `/guides/${slug}` },
  };
}

export default async function GuidePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const guide = findGuide(slug);
  if (!guide) notFound();

  const locale = await getHubLocale();
  const sections = guide.sections[locale];
  const t =
    locale === "en"
      ? { back: "All guides", related: "Related guides" }
      : { back: "所有指南", related: "相关指南" };

  const related = guides.filter((g) => g.slug !== slug).slice(0, 3);

  return (
    <main className="preference-page legal-page">
      <JsonLd
        data={guideStructuredData({
          slug: guide.slug,
          title: guide.title[locale],
          description: guide.description[locale],
          locale,
        })}
      />
      <article className="preference-card legal-card guide-detail-card">
        <div className="preference-heading-row">
          <Link className="preference-brand" href="/">
            DeepSeek Harness <strong>Plugin Hub</strong>
          </Link>
          <LanguageSwitch locale={locale} />
        </div>

        <nav className="guide-breadcrumb">
          <Link href="/guides">{t.back}</Link>
        </nav>

        <h1>{guide.title[locale]}</h1>
        <p className="preference-intro">{guide.description[locale]}</p>

        <div className="guide-content">
          {sections.map((section, i) => (
            <section key={i} className="guide-section">
              <h2>{section.heading}</h2>
              {section.paragraphs.map((p, j) => (
                <p key={j}>{p}</p>
              ))}
              {section.code ? (
                <pre className="guide-code">
                  <code>{section.code.content}</code>
                </pre>
              ) : null}
            </section>
          ))}
        </div>

        {related.length > 0 ? (
          <div className="guide-related">
            <h2>{t.related}</h2>
            <div className="guides-list">
              {related.map((g) => (
                <Link
                  key={g.slug}
                  href={`/guides/${g.slug}`}
                  className="guide-card"
                >
                  <h3>{g.title[locale]}</h3>
                  <p>{g.description[locale]}</p>
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </article>
    </main>
  );
}
