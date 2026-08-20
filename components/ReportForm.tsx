"use client";

import {
  TurnstileWidget,
  type TurnstileWidgetHandle,
} from "@/components/TurnstileWidget";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useRef, useState } from "react";

type FormState = "idle" | "submitting" | "success" | "error";

const copy = {
  zh: {
    eyebrow: "问题报告",
    title: "报告插件问题",
    intro:
      "如果你发现插件存在恶意代码、版权问题、安全漏洞或其他违规行为，请在这里告诉我们。",
    packageLabel: "插件包名",
    packagePlaceholder: "例如 @author/plugin-name（可选）",
    categoryLabel: "问题类型",
    categories: {
      malicious_code: "恶意代码",
      copyright: "版权侵权",
      security: "安全漏洞",
      spam: "垃圾信息",
      other: "其他",
    },
    descriptionLabel: "问题描述",
    descriptionPlaceholder: "请描述你发现的问题（至少 10 个字符）",
    emailLabel: "联系邮箱",
    emailPlaceholder: "可选，方便我们跟进",
    submit: "提交报告",
    submitting: "提交中…",
    success: "报告已提交，我们会尽快审查。",
    error: "提交失败，请稍后重试。",
    back: "返回插件列表",
  },
  en: {
    eyebrow: "REPORT",
    title: "Report a plugin issue",
    intro:
      "If you've found malicious code, copyright violations, security issues, or other policy violations in a plugin, let us know here.",
    packageLabel: "Package name",
    packagePlaceholder: "e.g. @author/plugin-name (optional)",
    categoryLabel: "Issue type",
    categories: {
      malicious_code: "Malicious code",
      copyright: "Copyright infringement",
      security: "Security vulnerability",
      spam: "Spam",
      other: "Other",
    },
    descriptionLabel: "Description",
    descriptionPlaceholder:
      "Describe the issue you found (at least 10 characters)",
    emailLabel: "Contact email",
    emailPlaceholder: "Optional, for follow-up",
    submit: "Submit report",
    submitting: "Submitting…",
    success: "Report submitted. We'll review it as soon as possible.",
    error: "Submission failed. Please try again later.",
    back: "Back to plugins",
  },
} as const;

export default function ReportForm({
  initialLanguage,
}: {
  initialLanguage: "en" | "zh";
}) {
  const language = initialLanguage;
  const searchParams = useSearchParams();
  const [formState, setFormState] = useState<FormState>("idle");
  const [turnstileToken, setTurnstileToken] = useState("");
  const turnstileRef = useRef<TurnstileWidgetHandle>(null);
  const t = copy[language];
  const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY ?? "";
  const prefillPackage = searchParams.get("package") ?? "";

  const handleTurnstileToken = useCallback((token: string) => {
    setTurnstileToken(token);
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (formState === "submitting") return;
    setFormState("submitting");

    const formData = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/report", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          packageName: formData.get("packageName") || null,
          category: formData.get("category"),
          description: formData.get("description"),
          reporterEmail: formData.get("reporterEmail") || null,
          website: formData.get("website"),
          turnstileToken,
          reportedUrl: window.location.href,
        }),
      });

      if (!response.ok) throw new Error("submit_failed");
      setFormState("success");
    } catch {
      setFormState("error");
      turnstileRef.current?.reset();
    }
  }

  if (formState === "success") {
    return (
      <div className="report-form-shell">
        <p className="report-success" role="status">
          {t.success}
        </p>
        <Link className="report-back-link" href="/plugins">
          {t.back}
        </Link>
      </div>
    );
  }

  return (
    <form className="report-form" onSubmit={handleSubmit}>
      <div className="report-field">
        <label htmlFor="report-package">{t.packageLabel}</label>
        <input
          id="report-package"
          name="packageName"
          type="text"
          defaultValue={prefillPackage}
          placeholder={t.packagePlaceholder}
          maxLength={200}
        />
      </div>

      <div className="report-field">
        <label htmlFor="report-category">{t.categoryLabel}</label>
        <select id="report-category" name="category" required>
          {Object.entries(t.categories).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="report-field">
        <label htmlFor="report-description">{t.descriptionLabel}</label>
        <textarea
          id="report-description"
          name="description"
          required
          minLength={10}
          maxLength={2000}
          rows={5}
          placeholder={t.descriptionPlaceholder}
        />
      </div>

      <div className="report-field">
        <label htmlFor="report-email">{t.emailLabel}</label>
        <input
          id="report-email"
          name="reporterEmail"
          type="email"
          placeholder={t.emailPlaceholder}
          maxLength={254}
        />
      </div>

      {/* Honeypot */}
      <div className="report-honeypot" aria-hidden="true">
        <input
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      {turnstileSiteKey ? (
        <TurnstileWidget
          ref={turnstileRef}
          siteKey={turnstileSiteKey}
          language={language}
          action="report"
          onTokenChange={handleTurnstileToken}
        />
      ) : null}

      <button
        className="report-submit"
        type="submit"
        disabled={
          formState === "submitting" ||
          (Boolean(turnstileSiteKey) && !turnstileToken)
        }
      >
        {formState === "submitting" ? t.submitting : t.submit}
      </button>

      {formState === "error" ? (
        <p className="report-error" role="alert">
          {t.error}
        </p>
      ) : null}
    </form>
  );
}
