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
          start: "Start here",
          startIntro: "New to DSH plugins? Follow the complete workflow from scaffold to a published listing.",
          read: "Read documentation",
          browse: "Browse the library",
          browseIntro: "Choose a topic based on what you are trying to accomplish.",
          articles: (count) => `${count} ${count === 1 ? "article" : "articles"}`,
          quickLinks: "Product resources",
          plugins: "Browse verified plugins",
          profiles: "Explore reproducible profiles",
          publish: "Open the publisher console",
          help: "Need a different answer?",
          helpBody: "Report a documentation gap or contact the community maintainers.",
          report: "Report a documentation issue",
        }
      : {
          eyebrow: "PLUGIN HUB 文档",
          title: "可靠地使用与构建插件",
          intro: "从发现、安装到开发与发布，面向 DSH 插件生态用户的实用文档。",
          start: "从这里开始",
          startIntro: "第一次接触 DSH 插件？按照完整流程，从脚手架一路完成发布与上架。",
          read: "阅读文档",
          browse: "浏览文档库",
          browseIntro: "根据你现在要完成的任务，选择对应主题。",
          articles: (count) => `${count} 篇文档`,
          quickLinks: "产品入口",
          plugins: "浏览已验证插件",
          profiles: "探索可复现 Profiles",
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
        <div>
          <p className="docs-eyebrow">{t.eyebrow}</p>
          <h1>{t.title}</h1>
          <p>{t.intro}</p>
        </div>
        <nav className="docs-product-links" aria-label={t.quickLinks}>
          <Link href="/plugins">{t.plugins}<span aria-hidden="true"> →</span></Link>
          <Link href="/profiles">{t.profiles}<span aria-hidden="true"> →</span></Link>
          <Link href="/dashboard">{t.publish}<span aria-hidden="true"> →</span></Link>
        </nav>
      </section>

      <div className="docs-home-shell">
        <aside className="docs-home-nav">
          <p>{t.browse}</p>
          {docCategories.map((category) => (
            <a key={category.id} href={`#${category.id}`}>
              {category.label[locale]}
            </a>
          ))}
        </aside>

        <div className="docs-home-content">
          {featured ? (
            <section className="docs-featured" aria-labelledby="docs-start-heading">
              <div>
                <p className="docs-section-label">{t.start}</p>
                <h2 id="docs-start-heading">{featured.title[locale]}</h2>
                <p>{t.startIntro}</p>
              </div>
              <Link href={`/docs/${featured.slug}`} prefetch={false}>
                {t.read}<span aria-hidden="true"> →</span>
              </Link>
            </section>
          ) : null}

          <div className="docs-library-heading">
            <div>
              <p className="docs-section-label">{t.browse}</p>
              <h2>{t.browse}</h2>
            </div>
            <p>{t.browseIntro}</p>
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
                    <div>
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
                        <span className="docs-card-icon" aria-hidden="true">↗</span>
                        <h3>{guide.title[locale]}</h3>
                        <p>{guide.description[locale]}</p>
                        <span className="docs-card-link">{t.read} →</span>
                      </Link>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>

          <aside className="docs-help-card">
            <div>
              <h2>{t.help}</h2>
              <p>{t.helpBody}</p>
            </div>
            <Link href="/report">{t.report} →</Link>
          </aside>
        </div>
      </div>
    </main>
  );
}
