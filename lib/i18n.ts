export type HubLocale = "zh" | "en";

export const HUB_LOCALE_COOKIE = "dsh-hub-locale";

export const localeTags: Record<HubLocale, "zh-CN" | "en"> = {
  zh: "zh-CN",
  en: "en",
};

export function parseHubLocale(value: unknown): HubLocale {
  return value === "en" ? "en" : "zh";
}

function isChineseLanguageTag(tag: string): boolean {
  const normalized = tag.trim().toLowerCase();
  return normalized === "zh" || normalized.startsWith("zh-");
}

export function localeFromAcceptLanguage(header: string | null | undefined): HubLocale {
  if (header == null || header.trim() === "") {
    return "en";
  }

  const entries = header.split(",").flatMap((part, index) => {
    const segments = part.trim().split(";");
    const tag = segments[0]?.trim() ?? "";
    if (!tag) {
      return [];
    }

    let q = 1;
    for (const param of segments.slice(1)) {
      const [key, raw] = param.split("=");
      if (key?.trim().toLowerCase() === "q" && raw != null) {
        const parsed = Number(raw.trim());
        if (!Number.isNaN(parsed)) {
          q = parsed;
        }
      }
    }

    return [{ tag, q, index }];
  });

  if (entries.length === 0) {
    return "en";
  }

  entries.sort((left, right) => right.q - left.q || left.index - right.index);
  return isChineseLanguageTag(entries[0].tag) ? "zh" : "en";
}

export function resolveHubLocale(cookie: unknown, acceptLanguage?: string | null): HubLocale {
  if (cookie === "en" || cookie === "zh") {
    return cookie;
  }
  return localeFromAcceptLanguage(acceptLanguage);
}
