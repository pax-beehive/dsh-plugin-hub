"use client";

import { useState } from "react";
import type { HubLocale } from "@/lib/i18n";

const copy = {
  zh: {
    errors: {
      package_not_found: "npm 上没有找到这个包或版本。",
      not_a_dsh_bundle_or_profile: "这个版本没有有效的 dsh.bundle 或 dsh.profile 声明。",
      invalid_repository: "Plugin 的 package.json 需要填写 GitHub repository。",
      invalid_distribution: "npm 返回的 tarball 信息无效。",
      package_owned_by_another_publisher: "这个包已被其他 Hub 发布者认领。",
      profile_owned_by_another_publisher: "这个 Profile 已被其他 Hub 发布者认领。",
      version_is_immutable: "这个版本已经存在，且内容不同；已发布版本不可覆盖。",
      slug_taken: "生成的 Hub 地址已被另一个包占用。",
      invalid_version_selector: "版本只能填写 exact SemVer 或 latest/next/beta/canary。",
      npm_document_too_large: "npm 包元数据过大，暂时无法自动同步。",
      npm_registry_unavailable: "npm Registry 暂时不可用，请稍后重试。",
    } as Record<string, string>,
    failed: "同步失败",
    retry: "同步失败，请稍后重试。",
    synced: "已同步",
    to: "至",
    packageName: "npm 包名",
    placeholder: "例如 dsh-example 或 @scope/dsh-example",
    syncing: "正在同步 npm…",
    sync: "立即同步",
    view: "查看页面 →",
  },
  en: {
    errors: {
      package_not_found: "This package or version was not found on npm.",
      not_a_dsh_bundle_or_profile: "No valid dsh.bundle or dsh.profile declaration was found.",
      invalid_repository: "The plugin package.json must declare a GitHub repository.",
      invalid_distribution: "npm returned invalid tarball metadata.",
      package_owned_by_another_publisher: "Another Hub publisher has claimed this package.",
      profile_owned_by_another_publisher: "Another Hub publisher has claimed this profile.",
      version_is_immutable: "This version already exists with different content and cannot be overwritten.",
      slug_taken: "Another package already uses the generated Hub URL.",
      invalid_version_selector: "Use an exact SemVer or latest/next/beta/canary.",
      npm_document_too_large: "The npm metadata is too large for automatic sync.",
      npm_registry_unavailable: "The npm Registry is temporarily unavailable.",
    } as Record<string, string>,
    failed: "Sync failed",
    retry: "Sync failed. Please try again later.",
    synced: "synced",
    to: "to",
    packageName: "npm package name",
    placeholder: "For example, dsh-example or @scope/dsh-example",
    syncing: "Syncing npm…",
    sync: "Sync now",
    view: "View page →",
  },
} as const;

export default function PublishNpmPackageForm({ locale }: { locale: HubLocale }) {
  const t = copy[locale];
  const [packageName, setPackageName] = useState("");
  const [status, setStatus] = useState<"idle" | "syncing" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  const [resultUrl, setResultUrl] = useState("");

  async function syncPackage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("syncing");
    setMessage("");
    setResultUrl("");
    try {
      const response = await fetch("/api/v1/manage/sync/npm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ packageName: packageName.trim() }),
      });
      const result = await response.json() as {
        status?: "accepted" | "rejected";
        kind?: "plugin" | "profile";
        slug?: string;
        latestVersion?: string;
        reason?: string;
        error?: string;
      };
      if (!response.ok || result.status !== "accepted" || !result.kind || !result.slug) {
        const code = result.reason ?? result.error ?? "npm_sync_failed";
        throw new Error(t.errors[code] ?? `${t.failed}: ${code}`);
      }
      setStatus("done");
      setMessage(`${result.kind === "plugin" ? "Plugin" : "Profile"} ${t.synced}${result.latestVersion ? ` ${t.to} ${result.latestVersion}` : ""}.`);
      setResultUrl(`/${result.kind === "plugin" ? "plugins" : "profiles"}/${result.slug}`);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : t.retry);
    }
  }

  return (
    <form className="npm-publish-form npm-sync-form" onSubmit={syncPackage}>
      <label>
        {t.packageName}
        <input
          autoComplete="off"
          disabled={status === "syncing"}
          onChange={(event) => setPackageName(event.target.value)}
          placeholder={t.placeholder}
          required
          value={packageName}
        />
      </label>
      <button disabled={status === "syncing" || !packageName.trim()} type="submit">
        {status === "syncing" ? t.syncing : t.sync}
      </button>
      {message ? (
        <p className={status === "error" ? "npm-publish-error" : "npm-publish-success"}>
          {message} {resultUrl ? <a href={resultUrl}>{t.view}</a> : null}
        </p>
      ) : null}
    </form>
  );
}
