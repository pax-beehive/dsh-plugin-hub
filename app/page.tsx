"use client";

import { FormEvent, useState } from "react";

type FormState =
  | "idle"
  | "submitting"
  | "subscribed"
  | "saved"
  | "duplicate"
  | "error";

const copy = {
  zh: {
    status: "即将上线",
    badge: "COMING SOON · 敬请期待",
    title: "DeepSeek Harness",
    accent: "Plugin Hub",
    intro:
      "一个集中发现、分享与安装 Harness 插件的开放社区。我们正在紧锣密鼓地打磨中，敬请期待。",
    email: "你的邮箱",
    submit: "上线时通知我",
    submitting: "正在加入…",
    subscribed: "订阅成功，欢迎邮件已发送，请检查收件箱。",
    saved: "邮箱已保存，欢迎邮件可能稍后送达。",
    duplicate: "你已经在等候名单里了。",
    error: "暂时无法提交，请稍后再试。",
    hint: "只发送产品上线和重要进展，不发垃圾邮件。",
    disclaimer:
      "非官方社区项目，由社区独立创建和维护，与 DeepSeek 官方无隶属、授权或背书关系。",
    cards: [
      ["⌘", "插件托管与分享", "发布、发现并安装 Harness 插件"],
      ["◈", "Harness 配置分享", "一键分享你的插件组合方案"],
      ["★", "评分与评价", "为插件与配置打分、写评价"],
    ],
  },
  en: {
    status: "Launching soon",
    badge: "COMING SOON",
    title: "DeepSeek Harness",
    accent: "Plugin Hub",
    intro:
      "An open community hub to discover, share, and install Harness plugins. We’re polishing the first release — stay tuned.",
    email: "Your email",
    submit: "Notify me",
    submitting: "Joining…",
    subscribed: "You’re on the list. Check your inbox for our welcome email.",
    saved: "Your email is saved. The welcome email may arrive later.",
    duplicate: "You’re already on the waitlist.",
    error: "We couldn’t save that right now. Please try again.",
    hint: "Only launch news and meaningful updates. No spam.",
    disclaimer:
      "An independent, unofficial community project. Not affiliated with, authorized by, or endorsed by DeepSeek.",
    cards: [
      ["⌘", "Plugin hosting & sharing", "Publish, discover, and install plugins"],
      ["◈", "Harness profiles", "Share your installed-plugin setups"],
      ["★", "Ratings & reviews", "Rate plugins and community profiles"],
    ],
  },
} as const;

export default function Home() {
  const [language, setLanguage] = useState<keyof typeof copy>("zh");
  const [formState, setFormState] = useState<FormState>("idle");
  const t = copy[language];

  async function submitWaitlist(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (formState === "submitting") return;

    const form = event.currentTarget;
    const formData = new FormData(form);
    setFormState("submitting");

    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: formData.get("email"),
          website: formData.get("website"),
          locale: language,
        }),
      });
      const result = (await response.json()) as {
        status?: string;
        emailStatus?: string;
      };

      if (!response.ok) throw new Error("waitlist request failed");
      setFormState(
        result.status === "already_subscribed"
          ? "duplicate"
          : result.emailStatus === "sent"
            ? "subscribed"
            : "saved",
      );
      form.reset();
    } catch {
      setFormState("error");
    }
  }

  const formMessage =
    formState === "subscribed"
      ? t.subscribed
      : formState === "saved"
        ? t.saved
      : formState === "duplicate"
        ? t.duplicate
        : formState === "error"
          ? t.error
          : t.hint;

  return (
    <main className="site-shell">
      <div className="grid-glow" aria-hidden="true" />
      <img
        className="whale-watermark"
        src="/deepseek-whale-black.svg"
        alt=""
        aria-hidden="true"
      />

      <header className="site-header">
        <a className="brand" href="#top" aria-label="Plugin Hub home">
          <span className="brand-mark">H</span>
          <span>
            DeepSeek Harness <strong>Plugin Hub</strong>
          </span>
        </a>

        <div className="header-actions">
          <span className="launch-status">
            <span aria-hidden="true" />
            {t.status}
          </span>
          <div className="language-switch" aria-label="Language">
            <button
              className={language === "zh" ? "active" : ""}
              onClick={() => setLanguage("zh")}
              type="button"
            >
              中文
            </button>
            <button
              className={language === "en" ? "active" : ""}
              onClick={() => setLanguage("en")}
              type="button"
            >
              EN
            </button>
          </div>
        </div>
      </header>

      <section className="hero" id="top">
        <p className="eyebrow">{t.badge}</p>
        <h1>
          {t.title}
          <span>{t.accent}</span>
        </h1>
        <p className="intro">{t.intro}</p>

        <form className="waitlist-form" onSubmit={submitWaitlist}>
          <label className="sr-only" htmlFor="waitlist-email">
            {t.email}
          </label>
          <input
            id="waitlist-email"
            type="email"
            name="email"
            placeholder="you@example.com"
            autoComplete="email"
            required
          />
          <div className="honeypot" aria-hidden="true">
            <label htmlFor="company-website">Website</label>
            <input
              id="company-website"
              name="website"
              type="text"
              tabIndex={-1}
              autoComplete="off"
            />
          </div>
          <button type="submit" disabled={formState === "submitting"}>
            {formState === "submitting" ? t.submitting : t.submit}
          </button>
        </form>
        <p
          className={`form-hint ${formState === "error" ? "error" : ""}`}
          aria-live="polite"
        >
          {formMessage}
        </p>

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

      <footer className="site-footer">
        <span>© 2026 DeepSeek Harness Plugin Hub</span>
        <span className="community-note">{t.disclaimer}</span>
      </footer>
    </main>
  );
}
