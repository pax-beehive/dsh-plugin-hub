"use client";

import {
  TurnstileWidget,
  type TurnstileWidgetHandle,
} from "@/components/TurnstileWidget";
import Image from "next/image";
import Link from "next/link";
import {
  FormEvent,
  useCallback,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

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
    subscribedButton: "已订阅",
    subscribed: "订阅成功，欢迎邮件已发送，请检查收件箱。",
    saved: "邮箱已保存，欢迎邮件可能稍后送达。",
    duplicate: "你已经在等候名单里了。",
    error: "暂时无法提交，请稍后再试。",
    hint: "只发送产品上线和重要进展，不发垃圾邮件。",
    privacyPrefix: "提交即表示你同意我们的",
    privacyLink: "隐私说明",
    disclaimer:
      "非官方社区项目，由社区独立创建和维护，与 DeepSeek 官方无隶属、授权或背书关系。",
    knowledgeEyebrow: "ABOUT THE HUB",
    knowledgeTitle: "为 Harness 插件生态而建的社区入口",
    knowledgeIntro:
      "DeepSeek Harness 采用“everything is a plugin”的架构。Plugin Hub 希望让社区插件和可复用配置更容易被发现、理解与采用。",
    officialSource: "查看 DeepSeek Harness 官方开源项目",
    faq: [
      [
        "DeepSeek Harness Plugin Hub 是什么？",
        "一个由社区独立维护的插件目录与分享平台，面向 DeepSeek Harness 的 dsh-plugin 生态。",
      ],
      [
        "现在可以使用吗？",
        "目前处于预发布阶段。首版计划支持发现、发布与安装插件，并分享可复用的 Harness 配置。",
      ],
      [
        "这是 DeepSeek 官方网站吗？",
        "不是。本站是非官方社区项目，与 DeepSeek 官方没有隶属、授权或背书关系。",
      ],
    ],
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
    subscribedButton: "Subscribed",
    subscribed: "You’re on the list. Check your inbox for our welcome email.",
    saved: "Your email is saved. The welcome email may arrive later.",
    duplicate: "You’re already on the waitlist.",
    error: "We couldn’t save that right now. Please try again.",
    hint: "Only launch news and meaningful updates. No spam.",
    privacyPrefix: "By submitting, you agree to our",
    privacyLink: "privacy notice",
    disclaimer:
      "An independent, unofficial community project. Not affiliated with, authorized by, or endorsed by DeepSeek.",
    knowledgeEyebrow: "ABOUT THE HUB",
    knowledgeTitle: "A community entry point for the Harness plugin ecosystem",
    knowledgeIntro:
      "DeepSeek Harness is built around an “everything is a plugin” architecture. Plugin Hub aims to make community plugins and reusable configurations easier to discover, understand, and adopt.",
    officialSource: "View the official DeepSeek Harness open-source project",
    faq: [
      [
        "What is DeepSeek Harness Plugin Hub?",
        "An independently maintained community directory and sharing platform for the DeepSeek Harness dsh-plugin ecosystem.",
      ],
      [
        "Can I use it now?",
        "The Hub is currently in pre-release. The first version is planned to support discovering, publishing, and installing plugins, plus sharing reusable Harness configurations.",
      ],
      [
        "Is this an official DeepSeek website?",
        "No. This is an unofficial community project and is not affiliated with, authorized by, or endorsed by DeepSeek.",
      ],
    ],
    cards: [
      ["⌘", "Plugin hosting & sharing", "Publish, discover, and install plugins"],
      ["◈", "Harness profiles", "Share your installed-plugin setups"],
      ["★", "Ratings & reviews", "Rate plugins and community profiles"],
    ],
  },
} as const;

function faqStructuredData(language: keyof typeof copy) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "@id": `https://dshpluginhub.ai${language === "en" ? "/en" : "/"}#faq`,
    inLanguage: language === "en" ? "en" : "zh-CN",
    mainEntity: copy[language].faq.map(([question, answer]) => ({
      "@type": "Question",
      name: question,
      acceptedAnswer: {
        "@type": "Answer",
        text: answer,
      },
    })),
  };
}

function pageStructuredData(language: keyof typeof copy) {
  const path = language === "en" ? "/en" : "/";
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `https://dshpluginhub.ai${path}#webpage`,
    url: `https://dshpluginhub.ai${path}`,
    name:
      language === "en"
        ? "DeepSeek Harness Plugin Hub — Discover and share plugins"
        : "DeepSeek Harness Plugin Hub — 插件发现与分享社区",
    description: copy[language].intro,
    isPartOf: { "@id": "https://dshpluginhub.ai/#website" },
    about: {
      "@type": "SoftwareApplication",
      name: "DeepSeek Harness",
      applicationCategory: "DeveloperApplication",
      url: "https://github.com/deepseek-ai/deepseek-harness",
    },
    inLanguage: language === "en" ? "en" : "zh-CN",
  };
}

function subscribeToWaitlistStorage(listener: () => void) {
  window.addEventListener("storage", listener);
  return () => window.removeEventListener("storage", listener);
}

function hasRecentWaitlistSubscription() {
  const storedAt = Number(localStorage.getItem("pluginhub.waitlistJoinedAt"));
  return Boolean(storedAt && Date.now() - storedAt < 30 * 24 * 60 * 60 * 1000);
}

export default function HomePage({
  initialLanguage = "zh",
}: {
  initialLanguage?: keyof typeof copy;
}) {
  const language = initialLanguage;
  const [formState, setFormState] = useState<FormState>("idle");
  const [turnstileToken, setTurnstileToken] = useState("");
  const turnstileRef = useRef<TurnstileWidgetHandle>(null);
  const previouslyJoined = useSyncExternalStore(
    subscribeToWaitlistStorage,
    hasRecentWaitlistSubscription,
    () => false,
  );
  const t = copy[language];
  const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY ?? "";
  const effectiveFormState =
    formState === "idle" && previouslyJoined ? "duplicate" : formState;
  const isComplete =
    effectiveFormState === "subscribed" ||
    effectiveFormState === "saved" ||
    effectiveFormState === "duplicate";

  const handleTurnstileToken = useCallback((token: string) => {
    setTurnstileToken(token);
  }, []);

  async function submitWaitlist(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (effectiveFormState === "submitting" || isComplete) return;

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
          turnstileToken,
          referrer: document.referrer,
          utmSource: new URLSearchParams(window.location.search).get(
            "utm_source",
          ),
          utmMedium: new URLSearchParams(window.location.search).get(
            "utm_medium",
          ),
          utmCampaign: new URLSearchParams(window.location.search).get(
            "utm_campaign",
          ),
        }),
      });
      const result = (await response.json()) as {
        status?: string;
        emailStatus?: string;
      };

      if (!response.ok) throw new Error("waitlist request failed");
      const nextState =
        result.status === "already_subscribed"
          ? "duplicate"
          : result.emailStatus === "sent"
            ? "subscribed"
            : "saved";
      setFormState(nextState);
      localStorage.setItem("pluginhub.waitlistJoinedAt", String(Date.now()));
    } catch {
      setFormState("error");
      turnstileRef.current?.reset();
    }
  }

  const formMessage =
    effectiveFormState === "subscribed"
      ? t.subscribed
      : effectiveFormState === "saved"
        ? t.saved
        : effectiveFormState === "duplicate"
          ? t.duplicate
          : effectiveFormState === "error"
            ? t.error
            : t.hint;

  return (
    <main className="site-shell" lang={language === "en" ? "en" : "zh-CN"}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(faqStructuredData(language)),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(pageStructuredData(language)),
        }}
      />
      <div className="grid-glow" aria-hidden="true" />
      <Image
        className="whale-watermark"
        src="/deepseek-whale-black.svg"
        alt=""
        aria-hidden="true"
        width={760}
        height={760}
        priority
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
            <Link
              className={language === "zh" ? "active" : ""}
              href="/"
              aria-current={language === "zh" ? "page" : undefined}
              hrefLang="zh-CN"
            >
              中文
            </Link>
            <Link
              className={language === "en" ? "active" : ""}
              href="/en"
              aria-current={language === "en" ? "page" : undefined}
              hrefLang="en"
            >
              EN
            </Link>
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

        <form
          className={`waitlist-form ${isComplete ? "is-complete" : ""}`}
          onSubmit={submitWaitlist}
        >
          <div className="waitlist-fields">
            <label className="sr-only" htmlFor="waitlist-email">
              {t.email}
            </label>
            <input
              id="waitlist-email"
              type="email"
              name="email"
              placeholder="you@example.com"
              autoComplete="email"
              disabled={isComplete}
              aria-describedby="waitlist-status"
              required
            />
            <button
              type="submit"
              className={isComplete ? "is-complete" : ""}
              disabled={
                effectiveFormState === "submitting" ||
                isComplete ||
                (Boolean(turnstileSiteKey) && !turnstileToken)
              }
            >
              {isComplete ? (
                <>
                  <span className="subscription-check" aria-hidden="true">
                    ✓
                  </span>
                  {t.subscribedButton}
                </>
              ) : effectiveFormState === "submitting" ? (
                t.submitting
              ) : (
                t.submit
              )}
            </button>
          </div>
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
          {!isComplete && turnstileSiteKey ? (
            <TurnstileWidget
              ref={turnstileRef}
              siteKey={turnstileSiteKey}
              language={language}
              onTokenChange={handleTurnstileToken}
            />
          ) : null}
        </form>
        <p
          id="waitlist-status"
          className={`form-hint ${effectiveFormState === "error" ? "error" : ""} ${isComplete ? "success" : ""}`}
          aria-live="polite"
        >
          {formMessage}
        </p>
        <p className="privacy-hint">
          {t.privacyPrefix} <a href="/privacy">{t.privacyLink}</a>。
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

      <section
        className="knowledge-section"
        aria-labelledby="knowledge-heading"
      >
        <div className="knowledge-heading">
          <p className="knowledge-eyebrow">{t.knowledgeEyebrow}</p>
          <h2 id="knowledge-heading">{t.knowledgeTitle}</h2>
          <p>{t.knowledgeIntro}</p>
          <a
            href="https://github.com/deepseek-ai/deepseek-harness"
            target="_blank"
            rel="noreferrer"
          >
            {t.officialSource}
            <span aria-hidden="true"> ↗</span>
          </a>
        </div>

        <div className="faq-list">
          {t.faq.map(([question, answer], index) => (
            <details key={question} open={index === 0}>
              <summary>{question}</summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </section>

      <footer className="site-footer">
        <span>© 2026 DeepSeek Harness Plugin Hub</span>
        <div className="footer-notes">
          <a href="/privacy">{t.privacyLink}</a>
          <span className="community-note">{t.disclaimer}</span>
        </div>
      </footer>
    </main>
  );
}
