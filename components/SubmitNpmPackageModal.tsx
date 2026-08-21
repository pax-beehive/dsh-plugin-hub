"use client";

import { useEffect, useId, useState } from "react";
import { hubCopy, type HubLocale } from "@/lib/i18n";

type ModalCopy = (typeof hubCopy)[HubLocale]["plugins"]["recommend"]["modal"];

function toFriendlyError(error: string | undefined, t: ModalCopy) {
  if (error === "invalid_submission") return t.invalid;
  if (error === "rate_limited") return t.rateLimited;
  if (error === "sync_queue_unavailable" || error === "sync_rate_limit_unavailable") {
    return t.unavailable;
  }
  return t.failed;
}

export default function SubmitNpmPackageModal({
  locale,
  onClose,
}: {
  locale: HubLocale;
  onClose: () => void;
}) {
  const t = hubCopy[locale].plugins.recommend.modal;
  const titleId = useId();
  const inputId = useId();
  const [packageName, setPackageName] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

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
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(toFriendlyError(body.error, t));
      setStatus("done");
      setMessage(t.queued);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : t.failed);
    }
  }

  return (
    <div
      className="modal-overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        aria-labelledby={titleId}
        aria-modal="true"
        className="modal-dialog"
        role="dialog"
      >
        <div className="modal-header">
          <h2 id={titleId}>{t.title}</h2>
          <button aria-label={t.close} className="modal-close" onClick={onClose} type="button">
            ×
          </button>
        </div>
        <p>{t.body}</p>
        <form onSubmit={submit}>
          <label className="sr-only" htmlFor={inputId}>
            {t.label}
          </label>
          <input
            autoComplete="off"
            disabled={status === "submitting"}
            id={inputId}
            onChange={(event) => setPackageName(event.target.value)}
            placeholder={t.placeholder}
            required
            value={packageName}
          />
          {message ? (
            <small className={status === "error" ? "error" : "success"}>{message}</small>
          ) : null}
          <div className="modal-actions">
            <button onClick={onClose} type="button">
              {t.cancel}
            </button>
            <button disabled={status === "submitting" || !packageName.trim()} type="submit">
              {status === "submitting" ? t.submitting : t.submit}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
