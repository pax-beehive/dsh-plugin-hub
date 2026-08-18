import LanguageSwitch from "@/components/LanguageSwitch";
import { getHubLocale } from "@/lib/i18n-server";
import type { Metadata } from "next";
import Link from "next/link";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getHubLocale();
  return {
    title: "Privacy Notice — DeepSeek Harness Plugin Hub",
    description: locale === "en"
      ? "How the independent DeepSeek Harness Plugin Hub handles waitlist information."
      : "DeepSeek Harness Plugin Hub 如何处理等候名单信息。",
    alternates: { canonical: "/privacy" },
  };
}

export default async function PrivacyPage() {
  const locale = await getHubLocale();
  const t = locale === "en" ? {
    eyebrow: "PRIVACY NOTICE",
    title: "How we use your email",
    intro: "How we use information submitted to the Plugin Hub waitlist.",
    sections: [
      ["What we collect", "We store the email you submit, language preference, subscription status, and available referral or UTM attribution. To prevent abuse, we also process Turnstile results and a hashed rate-limit identifier."],
      ["Purpose", "We use this information only for launch and meaningful project updates, aggregate interest measurement, and service security. We do not sell your email address."],
      ["Service providers", "Cloudflare infrastructure supports hosting, database storage, email delivery, and Turnstile security verification. Data may be processed in its systems as required to operate these services."],
      ["Retention and deletion", "Every email includes an unsubscribe option. After unsubscribing, we retain the minimum suppression record needed to avoid further email. You may request deletion at hello@dshpluginhub.ai."],
    ],
    updated: "Last updated: August 17, 2026. This is an independent, unofficial community project and is not affiliated with, authorized by, or endorsed by DeepSeek.",
    back: "Back to home",
  } : {
    eyebrow: "隐私说明",
    title: "你的邮箱如何被使用",
    intro: "我们如何使用你提交给 Plugin Hub 等候名单的信息。",
    sections: [
      ["我们收集什么", "我们保存你主动提交的邮箱、所选语言、订阅和退订状态，以及可能存在的来源、referrer 和 UTM 参数。为了防止滥用，系统还会处理 Turnstile 验证结果和经过哈希处理的限流标识。"],
      ["用途", "信息只用于发送上线通知和有意义的项目进展、衡量社区兴趣，以及保障订阅服务安全。我们不会出售你的邮箱。"],
      ["服务提供方", "网站、数据库、邮件发送和 Turnstile 安全验证由 Cloudflare 相关基础设施处理。数据可能按照这些服务的运行方式在其系统中处理。"],
      ["保留、退订与删除", "每封邮件都提供退订入口。退订后，我们会保留必要的抑制记录，避免继续发送邮件。你也可以联系 hello@dshpluginhub.ai 请求删除记录。"],
    ],
    updated: "最后更新：2026 年 8 月 17 日。本站是独立、非官方社区项目，与 DeepSeek 官方无隶属、授权或背书关系。",
    back: "返回首页",
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
        <p className="eyebrow">{t.eyebrow}</p>
        <h1>{t.title}</h1>
        <p className="preference-english">{t.intro}</p>
        {t.sections.map(([title, body]) => (
          <section key={title}>
            <h2>{title}</h2>
            <p>{body}</p>
          </section>
        ))}
        <p className="preference-disclaimer">{t.updated}</p>
        <Link className="preference-back" href="/">{t.back}</Link>
      </article>
    </main>
  );
}
