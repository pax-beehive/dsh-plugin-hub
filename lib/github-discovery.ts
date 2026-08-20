import type {
  D1GithubSourceStore,
  GithubSourceListingInput,
} from "@/db/github-source-store";

// GitHub topic discovery. Unlike npm search (which only surfaces published
// packages), the GitHub `dsh-plugin` topic captures the long tail of
// source-only community plugins. These enter the directory as source-only
// listings; once the author publishes an npm package with a DSH manifest,
// relinkAcceptedPlugins() connects the two records.
//
// Rate limits: unauthenticated GitHub search allows ~10 requests/minute, so
// each run processes at most maxPagesPerTopic pages per topic and persists a
// page cursor; the next cron run resumes where this one stopped. A 403/429
// response pauses discovery until the next run instead of failing the cron.
// Set the optional GITHUB_TOKEN secret to raise the ceiling.

export const githubDiscoveryTopics = ["dsh-plugin", "deepseek-harness"] as const;

const githubSearchPageSize = 100;
// GitHub search never serves beyond the first 1,000 results.
const maxSearchPage = 10;

type DiscoveryStore = Pick<
  D1GithubSourceStore,
  "upsertListing" | "relinkAcceptedPlugins" | "getCursor" | "setCursor"
>;

interface GithubSearchItem {
  full_name?: unknown;
  description?: unknown;
  stargazers_count?: unknown;
  language?: unknown;
  license?: { spdx_id?: unknown } | null;
  topics?: unknown;
  homepage?: unknown;
  pushed_at?: unknown;
  private?: unknown;
  fork?: unknown;
  archived?: unknown;
}

export async function discoverGitHubPlugins(input: {
  store: DiscoveryStore;
  fetcher?: typeof fetch;
  token?: string;
  now?: number;
  topics?: readonly string[];
  maxPagesPerTopic?: number;
}) {
  const fetcher = input.fetcher ?? fetch;
  const nowIso = new Date(input.now ?? Date.now()).toISOString();
  const topics = input.topics ?? githubDiscoveryTopics;
  const maxPages = Math.min(Math.max(input.maxPagesPerTopic ?? 3, 1), maxSearchPage);
  let discovered = 0;
  let rateLimited = false;

  for (const topic of topics) {
    const cursorKey = `github:topic:${topic}`;
    // Stored cursor is the NEXT page to fetch; 0 means "start a fresh cycle".
    let page = (await input.store.getCursor(cursorKey)) || 1;

    for (let fetched = 0; fetched < maxPages && page <= maxSearchPage; fetched += 1) {
      const url =
        `https://api.github.com/search/repositories?q=${encodeURIComponent(`topic:${topic}`)}` +
        `&sort=updated&order=desc&per_page=${githubSearchPageSize}&page=${page}`;
      const headers: Record<string, string> = {
        accept: "application/vnd.github+json",
        "user-agent": "dsh-plugin-hub/0.1",
        "x-github-api-version": "2022-11-28",
      };
      if (input.token) headers.authorization = `Bearer ${input.token}`;

      let response: Response;
      try {
        response = await fetcher(url, {
          headers,
          signal: AbortSignal.timeout(15_000),
        });
      } catch {
        // Network failure: keep the cursor, resume next run.
        break;
      }
      if (response.status === 403 || response.status === 429) {
        rateLimited = true;
        break;
      }
      if (!response.ok) break;

      const body = await response.json() as { items?: GithubSearchItem[] };
      const items = Array.isArray(body.items) ? body.items : [];
      for (const item of items) {
        const listing = toListing(item, topic);
        if (!listing) continue;
        await input.store.upsertListing(listing, nowIso);
        discovered += 1;
      }

      if (items.length < githubSearchPageSize || page >= maxSearchPage) {
        // Cycle complete (or hit the 1,000-result cap): restart from page 1
        // on the next run. Cursor 0 marks "fresh cycle".
        await input.store.setCursor(cursorKey, 0, nowIso);
        break;
      }
      page += 1;
      await input.store.setCursor(cursorKey, page, nowIso);
    }

    if (rateLimited) break;
  }

  await input.store.relinkAcceptedPlugins();
  return { discovered, rateLimited };
}

function toListing(
  item: GithubSearchItem,
  topic: string,
): GithubSourceListingInput | null {
  if (item.private === true || item.fork === true || item.archived === true) {
    return null;
  }
  if (typeof item.full_name !== "string" || !/^[\w.-]+\/[\w.-]+$/.test(item.full_name)) {
    return null;
  }
  const topics = Array.isArray(item.topics)
    ? item.topics.filter((entry): entry is string => typeof entry === "string")
    : [];
  return {
    fullName: item.full_name,
    description: typeof item.description === "string" ? item.description : "",
    stars: Number.isSafeInteger(item.stargazers_count)
      ? item.stargazers_count as number
      : 0,
    language: typeof item.language === "string" ? item.language : null,
    license: typeof item.license?.spdx_id === "string" &&
        item.license.spdx_id !== "NOASSERTION"
      ? item.license.spdx_id
      : null,
    topics,
    homepage: typeof item.homepage === "string" && item.homepage.trim() !== ""
      ? item.homepage
      : null,
    pushedAt: parseIso(item.pushed_at) ?? null,
    discoveryTopic: topic,
  };
}

function parseIso(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? undefined : date.toISOString();
}
