import LanguageSwitch from "@/components/LanguageSwitch";
import { getHubLocale } from "@/lib/i18n-server";
import Link from "next/link";
import type { Metadata } from "next";
import { ClearWaitlistState } from "./ClearWaitlistState";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getHubLocale();
  return {
    title: locale === "en" ? "Email preferences — DeepSeek Harness Plugin Hub" : "邮件偏好 — DeepSeek Harness Plugin Hub",
    description: locale === "en" ? "Manage Plugin Hub email preferences." : "管理 Plugin Hub 邮件偏好。",
    robots: { index: false, follow: false },
  };
}

type Props = { searchParams: Promise<{ status?: string; token?: string }> };

export default async function UnsubscribePage({ searchParams }: Props) {
  const [{ status, token }, locale] = await Promise.all([searchParams, getHubLocale()]);
  const isDone = status === "done";
  const isError = status === "error";
  const isInvalid = status === "invalid" || !token;
  const t = locale === "en" ? {
    done: "You’ve been unsubscribed",
    doneBody: "You will no longer receive Plugin Hub updates.",
    error: "We couldn’t process that",
    errorBody: "Please try again later.",
    invalid: "Invalid link",
    invalidBody: "This unsubscribe link is invalid or has expired.",
    eyebrow: "EMAIL PREFERENCES",
    confirm: "Unsubscribe?",
    confirmBody: "You will stop receiving Plugin Hub update emails.",
    button: "Unsubscribe",
    back: "Back to home",
    disclaimer: "Independent, unofficial community project",
  } : {
    done: "已成功退订",
    doneBody: "你将不会再收到 Plugin Hub 的更新邮件。",
    error: "暂时无法处理",
    errorBody: "请稍后再试。",
    invalid: "链接无效",
    invalidBody: "这个退订链接无效或已经过期。",
    eyebrow: "邮件偏好",
    confirm: "确认退订？",
    confirmBody: "确认后，你将不再收到 Plugin Hub 的更新邮件。",
    button: "确认退订",
    back: "返回首页",
    disclaimer: "非官方独立社区项目",
  };

  return (
    <main className="preference-page">
      <section className="preference-card">
        <div className="preference-heading-row">
          <Link className="preference-brand" href="/">DeepSeek Harness <strong>Plugin Hub</strong></Link>
          <LanguageSwitch locale={locale} />
        </div>
        {isDone ? (
          <><ClearWaitlistState /><p className="eyebrow">PREFERENCES UPDATED</p><h1>{t.done}</h1><p>{t.doneBody}</p></>
        ) : isError ? (
          <><h1>{t.error}</h1><p>{t.errorBody}</p></>
        ) : isInvalid ? (
          <><h1>{t.invalid}</h1><p>{t.invalidBody}</p></>
        ) : (
          <>
            <p className="eyebrow">{t.eyebrow}</p>
            <h1>{t.confirm}</h1>
            <p>{t.confirmBody}</p>
            <form action={`/api/waitlist/unsubscribe?token=${encodeURIComponent(token)}`} method="post">
              <button type="submit">{t.button}</button>
            </form>
          </>
        )}
        <Link className="preference-back" href="/">{t.back}</Link>
        <p className="preference-disclaimer">{t.disclaimer}</p>
      </section>
    </main>
  );
}
