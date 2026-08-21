import assert from "node:assert/strict";
import test from "node:test";
import {
  SITEMAP_CHUNK_SIZE,
  allSitemapEntries,
  buildSitemapShards,
  entriesForShard,
  listAllPackages,
  sitemapIndexLocs,
  sitemapShardIds,
  staticSitemapEntries,
  type PackageSearch,
} from "../lib/sitemap.ts";

function plugin(index: number) {
  return {
    slug: `plugin-${String(index).padStart(4, "0")}`,
    updatedAt: "2026-08-20T00:00:00.000Z",
  };
}

test("static sitemap omits /report and uses the trailing-slash homepage", () => {
  const urls = staticSitemapEntries().map((entry) => entry.url);
  assert.ok(urls.includes("https://dshpluginhub.ai/"));
  assert.ok(urls.includes("https://dshpluginhub.ai/plugins"));
  assert.ok(urls.includes("https://dshpluginhub.ai/docs"));
  assert.ok(urls.includes("https://dshpluginhub.ai/privacy"));
  assert.ok(urls.includes("https://dshpluginhub.ai/profiles"));
  assert.ok(urls.some((url) => url.startsWith("https://dshpluginhub.ai/docs/")));
  assert.equal(urls.includes("https://dshpluginhub.ai/report"), false);
  assert.equal(
    urls.filter((url) => url === "https://dshpluginhub.ai" || url === "https://dshpluginhub.ai/").length,
    1,
  );
});

test("lists every catalog page using the same page/total contract as /plugins", async () => {
  const total = 67;
  const search: PackageSearch = async (_query, options) => {
    const page = options?.page ?? 1;
    const limit = options?.limit ?? 50;
    const start = (page - 1) * limit;
    return {
      items: Array.from({ length: Math.max(0, Math.min(limit, total - start)) }, (_, i) =>
        plugin(start + i + 1),
      ),
      nextCursor: null,
      total,
    };
  };

  const plugins = await listAllPackages(search);
  assert.equal(plugins.length, 67);
  assert.equal(plugins[0]?.slug, "plugin-0001");
  assert.equal(plugins.at(-1)?.slug, "plugin-0067");
});

test("falls back to cursor pagination when the backend does not return total", async () => {
  const search: PackageSearch = async (_query, options) => {
    if (!options?.cursor) {
      return {
        items: [plugin(1), plugin(2)],
        nextCursor: "page-2",
      };
    }
    assert.equal(options.cursor, "page-2");
    return { items: [plugin(3)], nextCursor: null };
  };

  const plugins = await listAllPackages(search);
  assert.deepEqual(
    plugins.map((item) => item.slug),
    ["plugin-0001", "plugin-0002", "plugin-0003"],
  );
});

test("shards plugins and never puts /report in the index or urlset", () => {
  const plugins = Array.from({ length: SITEMAP_CHUNK_SIZE + 12 }, (_, i) => plugin(i + 1));
  const shards = buildSitemapShards({
    plugins,
    profiles: [{ slug: "team-web", updatedAt: "2026-08-20T00:00:00.000Z" }],
    categories: [{ name: "vision" }],
  });

  assert.equal(shards.plugins.length, 2);
  assert.equal(shards.plugins[0]?.length, SITEMAP_CHUNK_SIZE);
  assert.equal(shards.plugins[1]?.length, 12);
  assert.deepEqual(
    sitemapShardIds(shards).map((entry) => entry.id),
    [0, 1, 2],
  );
  assert.deepEqual(sitemapIndexLocs(shards), [
    "https://dshpluginhub.ai/sitemap/0.xml",
    "https://dshpluginhub.ai/sitemap/1.xml",
    "https://dshpluginhub.ai/sitemap/2.xml",
  ]);

  const staticUrls = entriesForShard(shards, 0).map((entry) => entry.url);
  assert.ok(staticUrls.includes("https://dshpluginhub.ai/profiles/team-web"));
  assert.ok(staticUrls.includes("https://dshpluginhub.ai/categories/vision"));
  assert.equal(staticUrls.some((url) => url.includes("/report")), false);
  assert.equal(staticUrls.some((url) => url.includes("/plugins/plugin-")), false);

  const pluginUrls = allSitemapEntries(shards).filter((entry) =>
    entry.url.includes("/plugins/plugin-"),
  );
  assert.ok(pluginUrls.length > 50);
  assert.equal(pluginUrls.length, SITEMAP_CHUNK_SIZE + 12);
  assert.equal(
    allSitemapEntries(shards).some((entry) => entry.url.endsWith("/report")),
    false,
  );
});

test("stops walking when the backend repeats the first page", async () => {
  let calls = 0;
  const firstPage = Array.from({ length: 50 }, (_, i) => plugin(i + 1));
  const search: PackageSearch = async () => {
    calls += 1;
    return { items: firstPage, nextCursor: null };
  };
  const plugins = await listAllPackages(search);
  assert.equal(plugins.length, 50);
  assert.equal(calls, 2);
});
