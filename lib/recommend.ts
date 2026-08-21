export const MAX_RECOMMEND_QUERY_CODE_POINTS = 500;
export const RECOMMEND_TIMEOUT_MS = 120_000;
export const MAX_RECOMMEND_ITEMS = 8;
export const MAX_REASON_CHARS = 160;

export type RecommendGithub = {
  stars: number;
  pushedAt?: string;
};

export type RecommendItem = {
  id: string;
  slug: string;
  displayName: string;
  packageName: string;
  latestVersion: string;
  summary: string;
  verified: boolean;
  claimed: boolean;
  categories: string[];
  github?: RecommendGithub;
  weeklyDownloads?: number;
  updatedAt: string;
  license?: string;
  reason?: string;
};

export type RecommendErrorCopy = {
  required: string;
  tooLarge: string;
  rateLimited: string;
  llmBusy: string;
  llmUnavailable: string;
  storageUnavailable: string;
  network: string;
  abort: string;
  failed: string;
};

export type RecommendErrorInput = {
  status?: number;
  error?: string;
  retryAfter?: string | null;
  kind?: "network" | "abort";
};

export function clampRecommendQuery(query: string): string {
  const trimmed = query.trim();
  const points = [...trimmed];
  if (points.length <= MAX_RECOMMEND_QUERY_CODE_POINTS) return trimmed;
  return points.slice(0, MAX_RECOMMEND_QUERY_CODE_POINTS).join("");
}

export function prepareRecommendQuery(
  query: string,
): { ok: true; query: string } | { ok: false; reason: "empty" } {
  const clamped = clampRecommendQuery(query);
  if (!clamped) return { ok: false, reason: "empty" };
  return { ok: true, query: clamped };
}

export function mapRecommendError(
  input: RecommendErrorInput,
  copy: RecommendErrorCopy,
): string {
  if (input.kind === "abort") return copy.abort;
  if (input.kind === "network") return copy.network;

  const code = input.error;
  if (code === "query_required") return copy.required;
  if (code === "query_too_large") return copy.tooLarge;
  if (code === "llm_busy" || (input.status === 429 && code === "llm_busy")) {
    return copy.llmBusy;
  }
  if (code === "rate_limited" || input.status === 429) return copy.rateLimited;
  if (code === "storage_unavailable") return copy.storageUnavailable;
  if (code === "llm_unavailable") return copy.llmUnavailable;
  if (input.status === 502 || input.status === 503) {
    return copy.llmUnavailable;
  }
  return copy.failed;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function parseGithub(value: unknown): RecommendGithub | undefined {
  const record = asRecord(value);
  if (!record || typeof record.stars !== "number" || !Number.isFinite(record.stars)) {
    return undefined;
  }
  return {
    stars: Math.max(0, Math.floor(record.stars)),
    ...(typeof record.pushedAt === "string" ? { pushedAt: record.pushedAt } : {}),
  };
}

export function parseRecommendItems(payload: unknown): RecommendItem[] {
  const envelope = asRecord(payload);
  const rawItems = envelope?.items;
  if (!Array.isArray(rawItems)) return [];

  const items: RecommendItem[] = [];
  for (const raw of rawItems) {
    const record = asRecord(raw);
    if (!record) continue;
    const slug = typeof record.slug === "string" ? record.slug.trim() : "";
    const displayName =
      typeof record.displayName === "string" ? record.displayName.trim() : "";
    if (!slug || !displayName) continue;

    const reason =
      typeof record.reason === "string" ? record.reason.trim() : "";
    items.push({
      id: typeof record.id === "string" && record.id ? record.id : slug,
      slug,
      displayName,
      packageName: typeof record.packageName === "string" ? record.packageName : "",
      latestVersion:
        typeof record.latestVersion === "string" ? record.latestVersion : "",
      summary: typeof record.summary === "string" ? record.summary : "",
      verified: record.verified === true,
      claimed: record.claimed === true,
      categories: Array.isArray(record.categories)
        ? record.categories.filter((entry): entry is string => typeof entry === "string")
        : [],
      github: parseGithub(record.github),
      ...(typeof record.weeklyDownloads === "number" && Number.isFinite(record.weeklyDownloads)
        ? { weeklyDownloads: Math.max(0, Math.floor(record.weeklyDownloads)) }
        : {}),
      updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : "",
      license: typeof record.license === "string" ? record.license : undefined,
      ...(reason ? { reason: [...reason].slice(0, MAX_REASON_CHARS).join("") } : {}),
    });
    if (items.length >= MAX_RECOMMEND_ITEMS) break;
  }
  return items;
}

export function readRecommendErrorCode(payload: unknown): string | undefined {
  const record = asRecord(payload);
  return typeof record?.error === "string" ? record.error : undefined;
}
