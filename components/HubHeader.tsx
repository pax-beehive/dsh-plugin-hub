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
      <Link href="/guides">{t.nav.guides}</Link>
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
  return (
    <footer className="hub-footer">
      <Link href="/privacy">
        {locale === "en" ? "Privacy" : "隐私说明"}
      </Link>
    </footer>
  );
}
