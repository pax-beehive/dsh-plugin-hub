import HubHeader from "@/components/HubHeader";
import Image from "next/image";
import Link from "next/link";

const copy = {
  zh: {
    status: "已上线",
    nav: {
      plugins: "Plugins",
      profiles: "Profiles",
      docs: "文档",
      status: "状态",
    },
    badge: "NOW LIVE · 现已上线",
    title: "DeepSeek Harness",
    accent: "插件注册表",
    intro: "自有插件注册表：精确版本与 manifest 校验。",
    exploreHub: "浏览插件",
    signIn: "登录",
    publishCta: "发布插件",
    disclaimer:
      "非官方社区项目，由社区独立创建和维护，与 DeepSeek 官方无隶属、授权或背书关系。",
    knowledgeEyebrow: "ABOUT THE REGISTRY",
    knowledgeTitle: "为 Harness 插件生态而建的社区入口",
    knowledgeIntro:
      "DeepSeek Harness 采用“everything is a plugin”的架构。Plugin Hub 希望让社区插件和可复用配置更容易被发现、理解与采用。",
    officialSource: "查看 DeepSeek Harness 官方开源项目",
    faq: [
      [
        "DeepSeek Harness Plugin Hub 是什么？",
        "一个由社区独立维护的插件目录与分享平台，面向 DeepSeek Harness 的 dsh-plugin 生态。",
      ],
      [
        "现在可以使用吗？",
        "可以。插件目录已公开，任何人都可以浏览、搜索并按说明安装插件；发布和认领插件需要登录。",
      ],
      [
        "这是 DeepSeek 官方网站吗？",
        "不是。本站是非官方社区项目，与 DeepSeek 官方没有隶属、授权或背书关系。",
      ],
    ],
    cards: [
      ["⌘", "插件托管与分享", "发布、发现并安装 Harness 插件"],
      ["◈", "Harness 配置分享", "一键分享你的插件组合方案"],
      ["★", "评分与评价", "为插件与配置打分、写评价"],
    ],
  },
  en: {
    status: "Live",
    nav: {
      plugins: "Plugins",
      profiles: "Profiles",
      docs: "Docs",
      status: "Status",
    },
    badge: "NOW LIVE",
    title: "DeepSeek Harness",
    accent: "plugin registry",
    intro: "Exact versions, verified manifests, and one-command installs for DeepSeek Harness plugins.",
    exploreHub: "Browse plugins",
    signIn: "Sign in",
    publishCta: "Publish a plugin",
    disclaimer:
      "An independent, unofficial community project. Not affiliated with, authorized by, or endorsed by DeepSeek.",
    knowledgeEyebrow: "ABOUT THE REGISTRY",
    knowledgeTitle: "A community entry point for the Harness plugin ecosystem",
    knowledgeIntro:
      "DeepSeek Harness is built around an “everything is a plugin” architecture. Plugin Hub aims to make community plugins and reusable configurations easier to discover, understand, and adopt.",
    officialSource: "View the official DeepSeek Harness open-source project",
    faq: [
      [
        "What is DeepSeek Harness Plugin Hub?",
        "An independently maintained community directory and sharing platform for the DeepSeek Harness dsh-plugin ecosystem.",
      ],
      [
        "Can I use it now?",
        "Yes. The plugin catalog is public — anyone can browse, search, and install plugins. Publishing and claiming plugins requires sign-in.",
      ],
      [
        "Is this an official DeepSeek website?",
        "No. This is an unofficial community project and is not affiliated with, authorized by, or endorsed by DeepSeek.",
      ],
    ],
    cards: [
      ["⌘", "Plugin hosting & sharing", "Publish, discover, and install plugins"],
      ["◈", "Harness profiles", "Share your installed-plugin setups"],
      ["★", "Ratings & reviews", "Rate plugins and community profiles"],
    ],
  },
} as const;

function faqStructuredData(language: keyof typeof copy) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "@id": "https://dshpluginhub.ai/#faq",
    inLanguage: language === "en" ? "en" : "zh-CN",
    mainEntity: copy[language].faq.map(([question, answer]) => ({
      "@type": "Question",
      name: question,
      acceptedAnswer: {
        "@type": "Answer",
        text: answer,
      },
    })),
  };
}

function pageStructuredData(language: keyof typeof copy) {
  const path = "/";
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `https://dshpluginhub.ai${path}#webpage`,
    url: `https://dshpluginhub.ai${path}`,
    name:
      language === "en"
        ? "DSH plugin registry — exact versions, manifests, one-command installs"
        : "DSH 插件注册表 — 精确版本、manifest 与一键安装",
    description: copy[language].intro,
    isPartOf: { "@id": "https://dshpluginhub.ai/#website" },
    about: {
      "@type": "SoftwareApplication",
      name: "DeepSeek Harness",
      applicationCategory: "DeveloperApplication",
      url: "https://github.com/deepseek-ai/deepseek-harness",
    },
    inLanguage: language === "en" ? "en" : "zh-CN",
  };
}

export default function HomePage({
  initialLanguage = "zh",
}: {
  initialLanguage?: keyof typeof copy;
}) {
  const language = initialLanguage;
  const t = copy[language];

  return (
    <main className="site-shell" lang={language === "en" ? "en" : "zh-CN"}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(faqStructuredData(language)),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(pageStructuredData(language)),
        }}
      />
      <div className="grid-glow" aria-hidden="true" />
      <Image
        className="whale-watermark"
        src="/deepseek-whale-black.svg"
        alt=""
        aria-hidden="true"
        width={760}
        height={760}
      />

      <HubHeader locale={language} />

      <section className="hero" id="top">
        <p className="eyebrow">{t.badge}</p>
        <h1>
          {t.title}{" "}
          <span>{t.accent}</span>
        </h1>
        <p className="intro">{t.intro}</p>

        <div className="hero-actions">
          <Link className="hub-entry-link" href="/plugins">
            {t.exploreHub}
          </Link>
          <Link className="hero-secondary-link" href="/sign-in">
            {t.publishCta}
          </Link>
        </div>

        <div className="feature-grid">
          {t.cards.map(([glyph, title, description]) => (
            <article className="feature-card" key={title}>
              <span className="feature-glyph" aria-hidden="true">
                {glyph}
              </span>
              <h2>{title}</h2>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section
        className="knowledge-section"
        aria-labelledby="knowledge-heading"
      >
        <div className="knowledge-heading">
          <p className="knowledge-eyebrow">{t.knowledgeEyebrow}</p>
          <h2 id="knowledge-heading">{t.knowledgeTitle}</h2>
          <p>{t.knowledgeIntro}</p>
          <a
            href="https://github.com/deepseek-ai/deepseek-harness"
            target="_blank"
            rel="noreferrer"
          >
            {t.officialSource}
            <span aria-hidden="true"> ↗</span>
          </a>
        </div>

        <div className="faq-list">
          {t.faq.map(([question, answer], index) => (
            <details key={question} open={index === 0}>
              <summary>{question}</summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </section>

    </main>
  );
}
