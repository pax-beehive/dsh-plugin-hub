"use client";

import { useState } from "react";
import type { HubLocale } from "@/lib/i18n";

const copy = {
  zh: {
    queued: "已进入验证队列；manifest 通过后会自动出现在目录中。",
    missing: "没找到？",
    label: "提交 npm 包名",
    placeholder: "粘贴 npm 包名",
    submitting: "提交中…",
    submit: "提交同步",
    invalid: "请输入有效的 npm 包名。",
    rateLimited: "提交得有点快，请稍后再试。",
    unavailable: "同步服务暂时不可用，请稍后再试。",
    failed: "提交失败，请稍后再试。",
  },
  en: {
    queued: "Added to the validation queue. It will appear after its manifest passes.",
    missing: "Can’t find it?",
    label: "Submit an npm package name",
    placeholder: "Paste an npm package name",
    submitting: "Submitting…",
    submit: "Submit for sync",
    invalid: "Enter a valid npm package name.",
    rateLimited: "Too many submissions. Please try again shortly.",
    unavailable: "The sync service is temporarily unavailable.",
    failed: "Submission failed. Please try again.",
  },
} as const;

export default function SubmitNpmPackageForm({ locale }: { locale: HubLocale }) {
  const t = copy[locale];
  const [packageName, setPackageName] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    setMessage("");
    try {
      const response = await fetch("/api/v1/packages/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ packageName: packageName.trim() }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(toFriendlyError(body.error, t));
      setStatus("done");
      setMessage(t.queued);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : t.failed);
    }
  }

  return (
    <form className="catalog-submit" onSubmit={submit}>
      <span>{t.missing}</span>
      <input
        aria-label={t.label}
        autoComplete="off"
        disabled={status === "submitting"}
        onChange={(event) => setPackageName(event.target.value)}
        placeholder={t.placeholder}
        required
        value={packageName}
      />
      <button disabled={status === "submitting" || !packageName.trim()} type="submit">
        {status === "submitting" ? t.submitting : t.submit}
      </button>
      {message ? <small className={status === "error" ? "error" : "success"}>{message}</small> : null}
    </form>
  );
}

function toFriendlyError(error: string | undefined, t: (typeof copy)[HubLocale]) {
  if (error === "invalid_submission") return t.invalid;
  if (error === "rate_limited") return t.rateLimited;
  if (error === "sync_queue_unavailable" || error === "sync_rate_limit_unavailable") {
    return t.unavailable;
  }
  return t.failed;
}
