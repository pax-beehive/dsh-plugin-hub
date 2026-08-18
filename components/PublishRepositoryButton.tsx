"use client";

import { useState } from "react";
import type { HubLocale } from "@/lib/i18n";

export default function PublishRepositoryButton({ repository, locale }: { repository: string; locale: HubLocale }) {
  const t = locale === "en" ? {
    claimed: "synced and claimed",
    failed: "Claim failed",
    verifying: "Verifying…",
    resync: "Sync again",
    claim: "Sync and claim",
  } : {
    claimed: "已同步并认领",
    failed: "认领失败",
    verifying: "正在验证…",
    resync: "重新同步",
    claim: "同步并认领",
  };
  const [status, setStatus] = useState<"idle" | "publishing" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function publish() {
    setStatus("publishing");
    setMessage("");
    try {
      const response = await fetch("/api/v1/manage/publish/github", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ repository }),
      });
      const result = (await response.json()) as {
        kind?: "plugin" | "profile";
        slug?: string;
        version?: string;
        error?: string;
      };
      if (!response.ok || !result.kind || !result.slug) {
        throw new Error(result.error ?? "publish_failed");
      }
      setStatus("done");
      setMessage(`${result.kind === "plugin" ? "Plugin" : "Profile"} ${result.version} ${t.claimed}`);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : t.failed);
    }
  }

  return (
    <div className="publish-action">
      <button type="button" onClick={publish} disabled={status === "publishing"}>
        {status === "publishing" ? t.verifying : status === "done" ? t.resync : t.claim}
      </button>
      {message ? <span className={status === "error" ? "error" : "success"}>{message}</span> : null}
    </div>
  );
}
