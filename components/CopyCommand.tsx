"use client";

import { useState } from "react";
import type { HubLocale } from "@/lib/i18n";

export default function CopyCommand({ command, locale = "zh" }: { command: string; locale?: HubLocale }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(command);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="install-command">
      <code>{command}</code>
      <button type="button" onClick={copy} aria-label={locale === "en" ? "Copy install command" : "复制安装命令"}>
        {copied ? (locale === "en" ? "Copied" : "已复制") : (locale === "en" ? "Copy" : "复制")}
      </button>
    </div>
  );
}
