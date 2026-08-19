import Link from "next/link";
import LanguageSwitch from "@/components/LanguageSwitch";
import { getHubLocale } from "@/lib/i18n-server";

export async function generateMetadata() {
  const locale = await getHubLocale();
  return {
    title: locale === "en" ? "Sign-in interrupted — DSH Plugin Hub" : "登录未完成 — DSH Plugin Hub",
    robots: { index: false, follow: false },
  };
}

export default async function AuthErrorPage() {
  const locale = await getHubLocale();
  const t = locale === "en" ? {
    eyebrow: "SIGN-IN INTERRUPTED",
    title: "Sign-in did not complete",
    body: "This authentication request did not establish a session. Try again later; if the problem continues, send the time of the failure to an administrator.",
    retry: "Try sign-in again",
  } : {
    eyebrow: "登录中断",
    title: "登录没有完成",
    body: "本次认证请求未能建立会话。请稍后重试；如果问题持续，请将出现问题的时间发给管理员。",
    retry: "重新登录",
  };
  return (
    <main className="dashboard-shell">
      <header className="dashboard-header">
        <Link className="brand" href="/">
          <span className="brand-mark">H</span>
          DSH <strong>Plugin Hub</strong>
        </Link>
        <LanguageSwitch locale={locale} />
      </header>
      <section className="dashboard-card">
        <p className="dashboard-eyebrow">{t.eyebrow}</p>
        <h1>{t.title}</h1>
        <p>{t.body}</p>
        <Link className="dashboard-primary" href="/sign-in">
          {t.retry}
        </Link>
      </section>
    </main>
  );
}
