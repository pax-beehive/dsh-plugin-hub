import HubHeader from "@/components/HubHeader";
import { docCategories, guides } from "@/lib/guides";
import { getHubLocale } from "@/lib/i18n-server";
import { pageMetadata } from "@/lib/page-metadata";
import type { Metadata } from "next";
import Link from "next/link";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getHubLocale();
  return pageMetadata({
    path: "/docs",
    title:
      locale === "en"
        ? "Documentation — DeepSeek Harness Plugin Hub"
        : "文档中心 — DeepSeek Harness Plugin Hub",
    description:
      locale === "en"
        ? "User documentation for discovering, installing, building, and publishing DSH plugins."
        : "面向用户的 DSH 插件发现、安装、开发与发布文档。",
  });
}

export default async function DocsPage() {
  const locale = await getHubLocale();
  const t =
    locale === "en"
      ? {
          eyebrow: "PLUGIN HUB DOCUMENTATION",
          title: "Build with confidence",
          intro:
            "Practical documentation for finding, installing, building, and publishing plugins across the DSH ecosystem.",
          startCta: "Get started",
          browse: "Browse the library",
          library: "All documentation",
          articles: (count: number) => `${count} ${count === 1 ? "article" : "articles"}`,
          quickLinks: "Product resources",
          plugins: "Browse verified plugins",
          publish: "Open the publisher console",
          help: "Need a different answer?",
          helpBody: "Report a documentation gap or contact the community maintainers.",
          report: "Report a documentation issue",
        }
      : {
          eyebrow: "PLUGIN HUB 文档",
          title: "可靠地使用与构建插件",
          intro: "从发现、安装到开发与发布，面向 DSH 插件生态用户的实用文档。",
          startCta: "开始使用",
          browse: "浏览文档库",
          library: "全部文档",
          articles: (count: number) => `${count} 篇文档`,
          quickLinks: "产品入口",
          plugins: "浏览已验证插件",
          publish: "打开发布控制台",
          help: "没有找到答案？",
          helpBody: "报告缺失的文档，或联系社区维护者。",
          report: "反馈文档问题",
        };

  const featured = guides.find((guide) => guide.slug === "first-plugin") ?? guides[0];

  return (
    <main className="docs-site">
      <HubHeader locale={locale} />

      <section className="docs-hero">
        <div className="docs-hero-copy">
          <p className="docs-eyebrow">{t.eyebrow}</p>
          <h1>{t.title}</h1>
          <p>{t.intro}</p>
          {featured ? (
            <Link
              className="docs-start-link"
              href={`/docs/${featured.slug}`}
              prefetch={false}
            >
              {t.startCta}<span aria-hidden="true"> ↗</span>
            </Link>
          ) : null}
        </div>
        <nav className="docs-product-links" aria-label={t.quickLinks}>
          <Link href="/plugins">{t.plugins}<span aria-hidden="true"> →</span></Link>
          <Link href="/dashboard">{t.publish}<span aria-hidden="true"> →</span></Link>
        </nav>
      </section>

      <div className="docs-home-content">
        <nav className="docs-path-grid" aria-label={t.browse}>
          {docCategories.map((category, index) => {
            const count = guides.filter(
              (guide) => guide.category === category.id,
            ).length;
            return (
              <a href={`#${category.id}`} key={category.id}>
                <span className="docs-path-index">0{index + 1}</span>
                <h2>{category.label[locale]}</h2>
                <p>{category.description[locale]}</p>
                <small>{t.articles(count)}</small>
              </a>
            );
          })}
        </nav>

        <section className="docs-library" aria-labelledby="docs-library-title">
          <div className="docs-library-title">
            <h2 id="docs-library-title">{t.library}</h2>
          </div>
          <div className="docs-category-list">
            {docCategories.map((category) => {
              const categoryGuides = guides.filter(
                (guide) => guide.category === category.id,
              );
              return (
                <section
                  className="docs-category"
                  id={category.id}
                  key={category.id}
                  aria-labelledby={`${category.id}-heading`}
                >
                  <div className="docs-category-heading">
                    <div className="docs-category-title">
                      <h2 id={`${category.id}-heading`}>{category.label[locale]}</h2>
                      <p>{category.description[locale]}</p>
                    </div>
                    <span>{t.articles(categoryGuides.length)}</span>
                  </div>
                  <div className="docs-card-grid">
                    {categoryGuides.map((guide) => (
                      <Link
                        className="docs-card"
                        href={`/docs/${guide.slug}`}
                        key={guide.slug}
                        prefetch={false}
                      >
                        <h3>{guide.title[locale]}</h3>
                        <p>{guide.description[locale]}</p>
                      </Link>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </section>

        <aside className="docs-help-card">
          <div>
            <h2>{t.help}</h2>
            <p>{t.helpBody}</p>
          </div>
          <Link href="/report">{t.report} →</Link>
        </aside>
      </div>
    </main>
  );
}
