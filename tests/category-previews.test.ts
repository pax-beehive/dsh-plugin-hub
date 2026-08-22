import assert from "node:assert/strict";
import test from "node:test";
import { loadCategoryPreviews } from "../lib/category-previews.ts";
import type { CategoryCount, PluginSummary } from "../lib/hub-api.ts";

const categories: CategoryCount[] = [
  { name: "agents-orchestration", displayName: "Agents & Orchestration", count: 215 },
  { name: "search-research", displayName: "Search & Research", count: 164 },
];

function plugin(category: string): PluginSummary {
  return {
    id: `${category}-id`,
    slug: `${category}-plugin`,
    packageName: `dsh-${category}`,
    displayName: `${category} plugin`,
    summary: "summary",
    repository: "owner/repository",
    categories: [category],
    latestVersion: "1.0.0",
    weeklyDownloads: 0,
    dailyDownloads: 0,
    dailyDownloadsDelta: 0,
    createdAt: "2026-08-21T00:00:00.000Z",
    updatedAt: "2026-08-21T00:00:00.000Z",
  };
}

test("category previews request each category explicitly instead of sampling the global catalog", async () => {
  const calls: Array<{ category?: string; locale?: string; limit?: number }> = [];
  const previews = await loadCategoryPreviews(categories, "zh", 3, async (_query, options) => {
    calls.push(options ?? {});
    return { items: options?.category ? [plugin(options.category)] : [] };
  });

  assert.deepEqual(calls, [
    { category: "agents-orchestration", limit: 3, locale: "zh" },
    { category: "search-research", limit: 3, locale: "zh" },
  ]);
  assert.equal(previews.get("search-research")?.length, 1);
  assert.equal(previews.get("search-research")?.[0]?.slug, "search-research-plugin");
});

test("one failed category preview does not empty the other categories", async () => {
  const previews = await loadCategoryPreviews(categories, "en", 3, async (_query, options) => {
    if (options?.category === "agents-orchestration") throw new Error("upstream failure");
    return { items: [plugin("search-research")] };
  });

  assert.deepEqual(previews.get("agents-orchestration"), []);
  assert.equal(previews.get("search-research")?.length, 1);
});
