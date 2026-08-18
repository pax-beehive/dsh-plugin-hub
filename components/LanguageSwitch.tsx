"use client";

import { HUB_LOCALE_COOKIE, type HubLocale } from "@/lib/i18n";
import { useState } from "react";

const maxAge = 365 * 24 * 60 * 60;

export default function LanguageSwitch({ locale }: { locale: HubLocale }) {
  const [pending, setPending] = useState(false);

  function select(nextLocale: HubLocale) {
    if (nextLocale === locale) return;
    setPending(true);
    document.cookie = `${HUB_LOCALE_COOKIE}=${nextLocale}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
    window.location.reload();
  }

  return (
    <div className="language-switch" aria-label="Language">
      <button
        aria-pressed={locale === "zh"}
        className={locale === "zh" ? "active" : ""}
        disabled={pending}
        onClick={() => select("zh")}
        type="button"
      >
        中文
      </button>
      <button
        aria-pressed={locale === "en"}
        className={locale === "en" ? "active" : ""}
        disabled={pending}
        onClick={() => select("en")}
        type="button"
      >
        EN
      </button>
    </div>
  );
}
