import LanguageSwitch from "@/components/LanguageSwitch";
import ReportForm from "@/components/ReportForm";
import { getHubLocale } from "@/lib/i18n-server";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getHubLocale();
  return {
    title:
      locale === "en"
        ? "Report an Issue — DeepSeek Harness Plugin Hub"
        : "报告问题 — DeepSeek Harness Plugin Hub",
    description:
      locale === "en"
        ? "Report malicious code, copyright violations, or security issues in DSH plugins."
        : "报告 DSH 插件中的恶意代码、版权侵权或安全问题。",
    alternates: { canonical: "/report" },
  };
}

export default async function ReportPage() {
  const locale = await getHubLocale();
  const t =
    locale === "en"
      ? {
          eyebrow: "REPORT",
          title: "Report a plugin issue",
          intro:
            "If you've found malicious code, copyright violations, security issues, or other policy violations in a plugin, let us know here.",
        }
      : {
          eyebrow: "问题报告",
          title: "报告插件问题",
          intro:
            "如果你发现插件存在恶意代码、版权问题、安全漏洞或其他违规行为，请在这里告诉我们。",
        };

  return (
    <main className="preference-page legal-page">
      <article className="preference-card legal-card">
        <div className="preference-heading-row">
          <Link className="preference-brand" href="/">
            DeepSeek Harness <strong>Plugin Hub</strong>
          </Link>
          <LanguageSwitch locale={locale} />
        </div>
        <p className="preference-eyebrow">{t.eyebrow}</p>
        <h1>{t.title}</h1>
        <p className="preference-intro">{t.intro}</p>
        <Suspense>
          <ReportForm initialLanguage={locale} />
        </Suspense>
      </article>
    </main>
  );
}
