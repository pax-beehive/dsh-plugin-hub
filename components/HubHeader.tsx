import Link from "next/link";
import LanguageSwitch from "./LanguageSwitch";
import { hubCopy, type HubLocale } from "@/lib/i18n";

export default function HubHeader({ locale }: { locale: HubLocale }) {
  const t = hubCopy[locale];
  return (
    <header className="hub-header">
      <Link className="brand" href="/">
        <span className="brand-mark">H</span>
        <span>
          DeepSeek Harness <strong>Plugin Hub</strong>
        </span>
      </Link>
      <nav className="hub-nav" aria-label="Hub navigation">
        <Link href="/plugins">{t.nav.plugins}</Link>
        <Link href="/profiles">{t.nav.profiles}</Link>
        <Link href="/status">{t.nav.status}</Link>
        <Link className="hub-publish-link" href="/dashboard">
          {t.nav.publish}
        </Link>
        <LanguageSwitch locale={locale} />
      </nav>
    </header>
  );
}
