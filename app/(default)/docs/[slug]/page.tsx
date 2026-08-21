import HubHeader from "@/components/HubHeader";
import { docCategories, findGuide, guides } from "@/lib/guides";
import { getHubLocale } from "@/lib/i18n-server";
import { pageMetadata } from "@/lib/page-metadata";
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
  return pageMetadata({
    path: `/docs/${slug}`,
    title: `${guide.title[locale]} — DSH Plugin Hub Docs`,
    description: guide.description[locale],
  });
}

export default async function DocPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const guide = findGuide(slug);
  if (!guide) notFound();

  const locale = await getHubLocale();
  const sections = guide.sections[locale];
  const category = docCategories.find((item) => item.id === guide.category);
  const t =
    locale === "en"
      ? {
          docs: "Documentation",
          onThisPage: "On this page",
          overview: "Overview",
          related: "Continue reading",
          updated: "Maintained by the Plugin Hub community",
          allDocs: "All documentation",
          articleSummary: "What you will learn",
        }
      : {
          docs: "文档中心",
          onThisPage: "本页内容",
          overview: "概览",
          related: "继续阅读",
          updated: "由 Plugin Hub 社区维护",
          allDocs: "全部文档",
          articleSummary: "你将了解",
        };

  const related = guides
    .filter((item) => item.slug !== slug)
    .sort((a, b) => Number(b.category === guide.category) - Number(a.category === guide.category))
    .slice(0, 3);

  return (
    <main className="docs-site">
      <JsonLd
        data={guideStructuredData({
          slug: guide.slug,
          title: guide.title[locale],
          description: guide.description[locale],
          locale,
        })}
      />
      <HubHeader locale={locale} />

      <div className="docs-article-shell">
        <aside className="docs-sidebar" aria-label={t.docs}>
          <Link className="docs-sidebar-home" href="/docs">{t.allDocs}</Link>
          {docCategories.map((group) => {
            const groupGuides = guides.filter((item) => item.category === group.id);
            return (
              <div className="docs-sidebar-group" key={group.id}>
                <p>{group.label[locale]}</p>
                {groupGuides.map((item) => (
                  <Link
                    aria-current={item.slug === slug ? "page" : undefined}
                    href={`/docs/${item.slug}`}
                    key={item.slug}
                    prefetch={false}
                  >
                    {item.title[locale]}
                  </Link>
                ))}
              </div>
            );
          })}
        </aside>

        <article className="docs-article">
          <nav className="docs-breadcrumb" aria-label="Breadcrumb">
            <Link href="/">Plugin Hub</Link>
            <span>/</span>
            <Link href="/docs">{t.docs}</Link>
            <span>/</span>
            <span>{category?.label[locale]}</span>
          </nav>

          <header className="docs-article-header" id="top">
            <p className="docs-section-label">{category?.label[locale]}</p>
            <h1>{guide.title[locale]}</h1>
            <p className="docs-article-lead">{guide.description[locale]}</p>
            <div className="docs-article-byline">
              <span>{t.updated}</span>
              <span>{sections.length} {locale === "en" ? "sections" : "个章节"}</span>
            </div>
          </header>

          <aside className="docs-summary">
            <strong>{t.articleSummary}</strong>
            <p>{guide.description[locale]}</p>
          </aside>

          <div className="docs-article-content">
            {sections.map((section, index) => (
              <section className="docs-article-section" id={`section-${index + 1}`} key={section.heading}>
                <h2>{section.heading}</h2>
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
                {section.code ? (
                  <div className="docs-code-block">
                    <span>{section.code.language}</span>
                    <pre><code>{section.code.content}</code></pre>
                  </div>
                ) : null}
              </section>
            ))}
          </div>

          <section className="docs-related" aria-labelledby="related-docs-heading">
            <p className="docs-section-label">{t.related}</p>
            <h2 id="related-docs-heading">{t.related}</h2>
            <div className="docs-related-grid">
              {related.map((item) => (
                <Link href={`/docs/${item.slug}`} key={item.slug} prefetch={false}>
                  <span>{docCategories.find((group) => group.id === item.category)?.label[locale]}</span>
                  <strong>{item.title[locale]}</strong>
                  <small>{item.description[locale]}</small>
                </Link>
              ))}
            </div>
          </section>
        </article>

        <aside className="docs-toc" aria-label={t.onThisPage}>
          <p>{t.onThisPage}</p>
          <a href="#top">{t.overview}</a>
          {sections.map((section, index) => (
            <a href={`#section-${index + 1}`} key={section.heading}>{section.heading}</a>
          ))}
        </aside>
      </div>
    </main>
  );
}
