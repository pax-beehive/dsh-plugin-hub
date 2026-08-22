"use client";

import { trackHubEvent } from "@/lib/ads-client";
import { useState } from "react";
import type { HubLocale } from "@/lib/i18n";

export default function CopyCommand({
  command,
  locale = "zh",
  packageName,
  profile,
  purpose = "install",
}: {
  command: string;
  locale?: HubLocale;
  packageName?: string;
  profile?: string;
  purpose?: "install" | "profile-share";
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(command);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
    if (purpose === "install") {
      void trackHubEvent("copy_install", {
        props: {
          package: packageName,
          profile,
          command,
        },
      });
    }
  }

  const commandLabel = purpose === "profile-share"
    ? (locale === "en" ? "Profile share command" : "Profile 分享命令")
    : (locale === "en" ? "Install command" : "安装命令");
  const copyLabel = purpose === "profile-share"
    ? (locale === "en" ? "Copy Profile share command" : "复制 Profile 分享命令")
    : (locale === "en" ? "Copy install command" : "复制安装命令");

  return (
    <div className="install-command">
      <div
        aria-label={commandLabel}
        className="install-command-scroll"
        role="region"
        // A keyboard focus target lets users scroll long commands without a pointer.
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
        tabIndex={0}
      >
        <code>{command}</code>
      </div>
      <button type="button" onClick={copy} aria-label={copyLabel}>
        {copied ? (locale === "en" ? "Copied" : "已复制") : (locale === "en" ? "Copy" : "复制")}
      </button>
    </div>
  );
}
