import Link from "next/link";
import BrandLogo from "./BrandLogo";
import LanguageSwitch from "./LanguageSwitch";
import { hubCopy, type HubLocale } from "@/lib/i18n";

function HeaderChrome({
  children,
  homeHref,
  locale,
}: {
  children: React.ReactNode;
  homeHref: string;
  locale: HubLocale;
}) {
  return (
    <header className="hub-header">
      <Link className="brand" href={homeHref}>
        <BrandLogo />
        <span>
          DeepSeek Harness <strong>Plugin Hub</strong>
        </span>
      </Link>
      <nav className="hub-nav" aria-label="Hub navigation">
        {children}
        <LanguageSwitch locale={locale} />
      </nav>
    </header>
  );
}

export default function HubHeader({ locale }: { locale: HubLocale }) {
  const t = hubCopy[locale];
  return (
    <HeaderChrome homeHref="/" locale={locale}>
      <Link href="/plugins">{t.nav.plugins}</Link>
      <Link href="/profiles">{t.nav.profiles}</Link>
      <Link href="/docs">{t.nav.docs}</Link>
      <Link href="/status">{t.nav.status}</Link>
      <Link className="hub-signin-link" href="/sign-in">
        {t.nav.signIn}
      </Link>
      <Link className="hub-publish-link" href="/dashboard">
        {t.nav.publish}
      </Link>
    </HeaderChrome>
  );
}

export function DashboardHeader({
  locale,
  contextAction,
}: {
  locale: HubLocale;
  contextAction?: { href: string; label: string };
}) {
  const t = hubCopy[locale];
  return (
    <HeaderChrome homeHref="/dashboard" locale={locale}>
      <Link href="/plugins">{t.nav.plugins}</Link>
      {contextAction ? (
        <Link className="hub-context-link" href={contextAction.href}>
          {contextAction.label}
        </Link>
      ) : null}
      <a className="hub-signin-link" href="/sign-out">
        {locale === "en" ? "Sign out" : "退出"}
      </a>
    </HeaderChrome>
  );
}

export function HubFooter({ locale }: { locale: HubLocale }) {
  const copy = locale === "en" ? {
    description:
      "Discover, verify, and share plugins and reproducible profiles for DeepSeek Harness.",
    explore: "Explore",
    community: "Community",
    resources: "Resources",
    plugins: "Plugins",
    profiles: "Profiles",
    docs: "Docs",
    publish: "Publish a plugin",
    contact: "Contact",
    report: "Report an issue",
    source: "Plugin Hub on GitHub",
    harness: "DeepSeek Harness",
    privacy: "Privacy notice",
    disclaimer:
      "Independent and unofficial. Not affiliated with, authorized by, or endorsed by DeepSeek.",
    label: "Site footer",
  } : {
    description: "发现、验证并分享 DeepSeek Harness 插件与可复现的 Profile。",
    explore: "探索",
    community: "社区",
    resources: "相关链接",
    plugins: "插件目录",
    profiles: "Profiles",
    docs: "文档中心",
    publish: "发布插件",
    contact: "联系我们",
    report: "报告问题",
    source: "Plugin Hub GitHub",
    harness: "DeepSeek Harness 官方项目",
    privacy: "隐私说明",
    disclaimer: "独立、非官方社区项目，与 DeepSeek 官方无隶属、授权或背书关系。",
    label: "网站页脚",
  };

  return (
    <footer className="hub-footer" aria-label={copy.label}>
      <div className="hub-footer-inner">
        <div className="hub-footer-grid">
          <div className="hub-footer-brand">
            <Link href="/" className="hub-footer-logo">
              <BrandLogo />
              <span>DeepSeek Harness <strong>Plugin Hub</strong></span>
            </Link>
            <p>{copy.description}</p>
          </div>

          <nav className="hub-footer-column" aria-label={copy.explore}>
            <h2>{copy.explore}</h2>
            <Link href="/plugins">{copy.plugins}</Link>
            <Link href="/profiles">{copy.profiles}</Link>
            <Link href="/docs">{copy.docs}</Link>
          </nav>

          <nav className="hub-footer-column" aria-label={copy.community}>
            <h2>{copy.community}</h2>
            <Link href="/dashboard">{copy.publish}</Link>
            <a href="mailto:hello@dshpluginhub.ai">{copy.contact}</a>
            <Link href="/report">{copy.report}</Link>
          </nav>

          <nav className="hub-footer-column" aria-label={copy.resources}>
            <h2>{copy.resources}</h2>
            <a href="https://github.com/pax-beehive/dsh-plugin-hub">{copy.source}</a>
            <a href="https://github.com/deepseek-ai/deepseek-harness">{copy.harness}</a>
            <Link href="/privacy">{copy.privacy}</Link>
          </nav>
        </div>

        <div className="hub-footer-bottom">
          <span>© 2026 DeepSeek Harness Plugin Hub</span>
          <p>{copy.disclaimer}</p>
        </div>
      </div>
    </footer>
  );
}
