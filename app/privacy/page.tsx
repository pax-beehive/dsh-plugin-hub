import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Notice — DeepSeek Harness Plugin Hub",
  description:
    "How the independent DeepSeek Harness Plugin Hub community project handles waitlist information.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <main className="preference-page legal-page">
      <article className="preference-card legal-card">
        <Link className="preference-brand" href="/">
          DeepSeek Harness <strong>Plugin Hub</strong>
        </Link>

        <p className="eyebrow">PRIVACY NOTICE · 隐私说明</p>
        <h1>你的邮箱如何被使用</h1>
        <p className="preference-english">
          How we use information submitted to the Plugin Hub waitlist.
        </p>

        <section>
          <h2>我们收集什么 · What we collect</h2>
          <p>
            我们保存你主动提交的邮箱、所选语言、订阅和退订状态，以及可能存在的来源、referrer
            和 UTM 参数。为了防止滥用，系统还会处理 Turnstile 验证结果和经过哈希处理的限流标识。
          </p>
          <p>
            We store the email you submit, language preference, subscription
            status, and available referral or UTM attribution. To prevent abuse,
            we also process Turnstile results and a hashed rate-limit identifier.
          </p>
        </section>

        <section>
          <h2>用途 · Purpose</h2>
          <p>
            信息只用于发送上线通知和有意义的项目进展、衡量社区兴趣，以及保障订阅服务安全。我们不会出售你的邮箱。
          </p>
          <p>
            We use this information only for launch and meaningful project
            updates, aggregate interest measurement, and service security. We do
            not sell your email address.
          </p>
        </section>

        <section>
          <h2>服务提供方 · Service providers</h2>
          <p>
            网站、数据库、邮件发送和 Turnstile 安全验证由 Cloudflare
            相关基础设施处理。数据可能按照这些服务的运行方式在其系统中处理。
          </p>
          <p>
            Cloudflare infrastructure supports hosting, database storage, email
            delivery, and Turnstile security verification.
          </p>
        </section>

        <section>
          <h2>保留、退订与删除 · Retention and deletion</h2>
          <p>
            每封邮件都提供退订入口。退订后，我们会保留必要的抑制记录，避免继续发送邮件。你也可以联系
            hello@dshpluginhub.ai 请求删除记录。
          </p>
          <p>
            Every email includes an unsubscribe option. After unsubscribing, we
            retain the minimum suppression record needed to avoid further email.
            You may request deletion at hello@dshpluginhub.ai.
          </p>
        </section>

        <p className="preference-disclaimer">
          Last updated: August 17, 2026. This is an independent, unofficial
          community project and is not affiliated with, authorized by, or endorsed
          by DeepSeek.
        </p>
        <Link className="preference-back" href="/">
          返回首页 · Back to home
        </Link>
      </article>
    </main>
  );
}
