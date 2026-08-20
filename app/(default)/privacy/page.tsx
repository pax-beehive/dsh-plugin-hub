import LanguageSwitch from "@/components/LanguageSwitch";
import { getHubLocale } from "@/lib/i18n-server";
import type { Metadata } from "next";
import Link from "next/link";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getHubLocale();
  return {
    title: "Privacy Notice — DeepSeek Harness Plugin Hub",
    description: locale === "en"
      ? "How the independent DeepSeek Harness Plugin Hub handles information."
      : "DeepSeek Harness Plugin Hub 如何处理信息。",
    alternates: { canonical: "/privacy" },
  };
}

export default async function PrivacyPage() {
  const locale = await getHubLocale();
  const t = locale === "en" ? {
    eyebrow: "PRIVACY NOTICE",
    title: "How we handle your information",
    intro: "How the Plugin Hub processes information when you browse the catalog, sign in, or submit a report.",
    sections: [
      ["What we collect", "Browsing the plugin catalog is anonymous and requires no account. If you sign in, we store your WorkOS account details (email, name, and avatar) to identify you and attribute plugins you publish. If you submit an abuse report, we process the report content and an optional contact email. To prevent abuse, we also process Turnstile verification results and hashed rate-limit identifiers."],
      ["Purpose", "We use this information only to operate the plugin directory, attribute published plugins to their owners, respond to abuse reports, and keep the service secure. We do not sell personal information, and we do not run an email list."],
      ["Service providers", "Cloudflare provides hosting and Turnstile security verification. WorkOS provides sign-in. The backend API and database run on Google Cloud. Data may be processed in these systems as required to operate the service."],
      ["Retention and deletion", "We keep account and report information only as long as needed to operate the service. You may request deletion of your information at hello@dshpluginhub.ai."],
    ],
    updated: "Last updated: August 19, 2026. This is an independent, unofficial community project and is not affiliated with, authorized by, or endorsed by DeepSeek.",
    back: "Back to home",
  } : {
    eyebrow: "隐私说明",
    title: "我们如何处理你的信息",
    intro: "当你浏览插件目录、登录或提交举报时，Plugin Hub 如何处理相关信息。",
    sections: [
      ["我们收集什么", "浏览插件目录是匿名的，无需注册。如果你登录，我们会保存你的 WorkOS 账号信息（邮箱、姓名、头像），用于标识你的身份并归属你发布的插件。如果你提交滥用举报，我们会处理举报内容和你可选填写的联系邮箱。为了防止滥用，系统还会处理 Turnstile 验证结果和经过哈希处理的限流标识。"],
      ["用途", "这些信息只用于运营插件目录、将发布的插件归属给作者、处理滥用举报，以及保障服务安全。我们不会出售个人信息，也不运营邮件列表。"],
      ["服务提供方", "Cloudflare 提供网站托管和 Turnstile 安全验证，WorkOS 提供登录服务，后端 API 和数据库运行在 Google Cloud 上。数据可能按照这些服务的运行方式在其系统中处理。"],
      ["保留与删除", "账号和举报信息仅在运营服务所需期间保留。你可以联系 hello@dshpluginhub.ai 请求删除你的信息。"],
    ],
    updated: "最后更新：2026 年 8 月 19 日。本站是独立、非官方社区项目，与 DeepSeek 官方无隶属、授权或背书关系。",
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
