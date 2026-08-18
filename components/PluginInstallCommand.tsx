"use client";

import {
  buildOfficialPluginInstallCommand,
  DEFAULT_TARGET_PROFILE,
  isValidTargetProfile,
} from "@/lib/install-command";
import { useEffect, useState } from "react";
import CopyCommand from "./CopyCommand";
import type { HubLocale } from "@/lib/i18n";

const storageKey = "dsh-hub-target-profile";
const presetProfiles = ["web", "headless"] as const;
type ProfileMode = (typeof presetProfiles)[number] | "custom";

export default function PluginInstallCommand({
  installSpec,
  locale,
}: {
  installSpec: string;
  locale: HubLocale;
}) {
  const t = locale === "en" ? {
    aria: "Install command",
    target: "Target profile",
    hint: "The plugin will be installed here. Keep web if you are unsure.",
    default: "web (default)",
    custom: "Custom…",
    customLabel: "Custom profile name",
    placeholder: "For example, research",
    invalid: "Profile names may contain only letters, numbers, dots, underscores, and hyphens.",
  } : {
    aria: "安装命令",
    target: "目标 Profile",
    hint: "插件会安装到这里；不确定时保持 web。",
    default: "web（默认）",
    custom: "自定义…",
    customLabel: "自定义 Profile 名称",
    placeholder: "例如 research",
    invalid: "Profile 名称只能包含字母、数字、点、下划线和连字符。",
  };
  const [mode, setMode] = useState<ProfileMode>(DEFAULT_TARGET_PROFILE);
  const [customProfile, setCustomProfile] = useState("");

  useEffect(() => {
    const restoreStoredProfile = () => {
      try {
        const stored = window.localStorage.getItem(storageKey);
        if (!stored || !isValidTargetProfile(stored)) return;
        if (presetProfiles.includes(stored as (typeof presetProfiles)[number])) {
          setMode(stored as (typeof presetProfiles)[number]);
        } else {
          setMode("custom");
          setCustomProfile(stored);
        }
      } catch {
        // Storage can be unavailable in hardened browsers; web remains the default.
      }
    };
    const timeout = window.setTimeout(restoreStoredProfile, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  const targetProfile = mode === "custom" ? customProfile.trim() : mode;
  const valid = isValidTargetProfile(targetProfile);
  const command = valid
    ? buildOfficialPluginInstallCommand(installSpec, targetProfile)
    : null;

  function remember(profile: string) {
    if (!isValidTargetProfile(profile)) return;
    try {
      window.localStorage.setItem(storageKey, profile);
    } catch {
      // The command remains usable when persistence is blocked.
    }
  }

  function selectMode(nextMode: ProfileMode) {
    setMode(nextMode);
    if (nextMode !== "custom") remember(nextMode);
  }

  function updateCustomProfile(value: string) {
    setCustomProfile(value);
    remember(value.trim());
  }

  return (
    <section className="plugin-install-panel" aria-label={t.aria}>
      <div className="profile-target-control">
        <div>
          <label htmlFor="target-profile">{t.target}</label>
          <p>{t.hint}</p>
        </div>
        <div className="profile-target-inputs">
          <select
            id="target-profile"
            onChange={(event) => selectMode(event.target.value as ProfileMode)}
            value={mode}
          >
            <option value="web">{t.default}</option>
            <option value="headless">headless</option>
            <option value="custom">{t.custom}</option>
          </select>
          {mode === "custom" ? (
            <input
              aria-label={t.customLabel}
              autoComplete="off"
              maxLength={80}
              onChange={(event) => updateCustomProfile(event.target.value)}
              pattern="[A-Za-z0-9._-]+"
              placeholder={t.placeholder}
              spellCheck={false}
              value={customProfile}
            />
          ) : null}
        </div>
      </div>
      {command ? (
        <CopyCommand command={command} locale={locale} />
      ) : (
        <p className="profile-target-error" role="status">
          {t.invalid}
        </p>
      )}
    </section>
  );
}
