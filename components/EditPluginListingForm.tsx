"use client";

import { useState } from "react";
import type { HubLocale } from "@/lib/i18n";

interface EditablePlugin {
  slug: string;
  packageName: string;
  displayName: string;
  summary: string;
  description: string;
  homepage: string;
  categories: string[];
  keywords: string[];
  screenshots: Array<{ url: string; alt: string }>;
  publisherMetadata: {
    compatibility?: {
      dsh?: string;
      hmr?: "full" | "config" | "refresh" | "restart";
    };
  };
}

export default function EditPluginListingForm({ plugin, locale }: { plugin: EditablePlugin; locale: HubLocale }) {
  const t = locale === "en" ? {
    saved: "Listing details saved. Future npm syncs will preserve these author-provided fields.",
    failed: "Could not update the listing.",
    displayName: "Display name",
    summary: "One-line summary",
    description: "Description",
    compatibility: "DSH compatibility",
    categories: "Categories (comma-separated)",
    keywords: "Keywords (comma-separated)",
    manifest: "Use manifest value",
    hmrFull: "Applies immediately",
    hmrConfig: "Recompose configuration",
    hmrRefresh: "Refresh page",
    hmrRestart: "Restart process",
    screenshots: "Screenshots (one per line: HTTPS URL | description)",
    saving: "Saving…",
    save: "Save listing",
    screenshotError: "Each screenshot needs URL | description",
  } : {
    saved: "页面资料已保存，后续 npm 自动同步会保留这些作者补充内容。",
    failed: "页面资料保存失败。",
    displayName: "显示名称",
    summary: "一句话描述",
    description: "详细说明",
    compatibility: "DSH 兼容范围",
    categories: "分类（逗号分隔）",
    keywords: "关键词（逗号分隔）",
    manifest: "使用 manifest 信息",
    hmrFull: "即时生效",
    hmrConfig: "重新组合配置",
    hmrRefresh: "刷新页面",
    hmrRestart: "重启进程",
    screenshots: "截图（每行：HTTPS URL | 说明）",
    saving: "正在保存…",
    save: "保存页面资料",
    screenshotError: "每张截图需要填写 URL | 说明",
  };
  const [displayName, setDisplayName] = useState(plugin.displayName);
  const [summary, setSummary] = useState(plugin.summary);
  const [description, setDescription] = useState(plugin.description);
  const [homepage, setHomepage] = useState(plugin.homepage);
  const [categories, setCategories] = useState(plugin.categories.join(", "));
  const [keywords, setKeywords] = useState(plugin.keywords.join(", "));
  const [screenshots, setScreenshots] = useState(
    plugin.screenshots.map((item) => `${item.url} | ${item.alt}`).join("\n"),
  );
  const [dsh, setDsh] = useState(plugin.publisherMetadata.compatibility?.dsh ?? "");
  const [hmr, setHmr] = useState(plugin.publisherMetadata.compatibility?.hmr ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("saving");
    setMessage("");
    try {
      const response = await fetch(`/api/v1/manage/plugins/${plugin.slug}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          displayName,
          summary,
          description,
          homepage,
          categories: splitList(categories, 12),
          keywords: splitList(keywords, 30),
          screenshots: parseScreenshots(screenshots, t.screenshotError),
          publisherMetadata: {
            ...(dsh.trim() || hmr
              ? {
                  compatibility: {
                    ...(dsh.trim() ? { dsh: dsh.trim() } : {}),
                    ...(hmr ? { hmr } : {}),
                  },
                }
              : {}),
          },
        }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "listing_update_failed");
      setStatus("done");
      setMessage(t.saved);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : t.failed);
    }
  }

  return (
    <form className="listing-edit-form" onSubmit={save}>
      <label>
        {t.displayName}
        <input maxLength={120} onChange={(event) => setDisplayName(event.target.value)} required value={displayName} />
      </label>
      <label>
        {t.summary}
        <input maxLength={300} onChange={(event) => setSummary(event.target.value)} required value={summary} />
      </label>
      <label className="listing-edit-wide">
        {t.description}
        <textarea maxLength={20_000} onChange={(event) => setDescription(event.target.value)} rows={8} value={description} />
      </label>
      <label>
        Homepage（HTTPS）
        <input onChange={(event) => setHomepage(event.target.value)} placeholder="https://…" type="url" value={homepage} />
      </label>
      <label>
        {t.compatibility}
        <input maxLength={120} onChange={(event) => setDsh(event.target.value)} placeholder=">=0.1.0-rc.7" value={dsh} />
      </label>
      <label>
        {t.categories}
        <input onChange={(event) => setCategories(event.target.value)} value={categories} />
      </label>
      <label>
        {t.keywords}
        <input onChange={(event) => setKeywords(event.target.value)} value={keywords} />
      </label>
      <label>
        HMR
        <select onChange={(event) => setHmr(event.target.value)} value={hmr}>
          <option value="">{t.manifest}</option>
          <option value="full">{t.hmrFull}</option>
          <option value="config">{t.hmrConfig}</option>
          <option value="refresh">{t.hmrRefresh}</option>
          <option value="restart">{t.hmrRestart}</option>
        </select>
      </label>
      <label className="listing-edit-wide">
        {t.screenshots}
        <textarea onChange={(event) => setScreenshots(event.target.value)} rows={4} value={screenshots} />
      </label>
      <div className="listing-edit-actions listing-edit-wide">
        <button disabled={status === "saving"} type="submit">
          {status === "saving" ? t.saving : t.save}
        </button>
        {message ? <span className={status === "error" ? "error" : "success"}>{message}</span> : null}
      </div>
    </form>
  );
}

function splitList(value: string, max: number): string[] {
  return [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))].slice(0, max);
}

function parseScreenshots(value: string, errorMessage: string): Array<{ url: string; alt: string }> {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 8)
    .map((line) => {
      const separator = line.indexOf("|");
      if (separator < 0) throw new Error(errorMessage);
      return {
        url: line.slice(0, separator).trim(),
        alt: line.slice(separator + 1).trim(),
      };
    });
}
