import assert from "node:assert/strict";
import test from "node:test";
import {
  SITEMAP_CHUNK_SIZE,
  allSitemapEntries,
  buildSitemapShards,
  entriesForShard,
  listAllPackages,
  listAllPackageSlugs,
  sitemapEntriesToXml,
  sitemapIndexLocs,
  sitemapShardIds,
  staticSitemapEntries,
  type PackageSearch,
} from "../lib/sitemap.ts";
import { parseSitemapPackageSearchResponse } from "../lib/registry-search-response.ts";

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
  assert.ok(urls.includes("https://dshpluginhub.ai/categories"));
  assert.ok(urls.includes("https://dshpluginhub.ai/docs"));
  assert.equal(urls.includes("https://dshpluginhub.ai/status"), false);
  assert.ok(urls.includes("https://dshpluginhub.ai/privacy"));
  assert.ok(urls.includes("https://dshpluginhub.ai/profiles"));
  assert.ok(urls.some((url) => url.startsWith("https://dshpluginhub.ai/docs/")));
  assert.equal(urls.includes("https://dshpluginhub.ai/report"), false);
  assert.equal(
    urls.filter((url) => url === "https://dshpluginhub.ai" || url === "https://dshpluginhub.ai/").length,
    1,
  );
});

test("sitemap includes /categories and each taxonomy child URL", () => {
  const shards = buildSitemapShards({
    categories: [
      { name: "agents-orchestration" },
      { name: "memory-context" },
    ],
  });
  const urls = allSitemapEntries(shards).map((entry) => entry.url);
  assert.ok(urls.includes("https://dshpluginhub.ai/categories"));
  assert.ok(urls.includes("https://dshpluginhub.ai/categories/agents-orchestration"));
  assert.ok(urls.includes("https://dshpluginhub.ai/categories/memory-context"));
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
  assert.ok(staticUrls.includes("https://dshpluginhub.ai/profiles"));
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

test("serializes a urlset Vinext can serve from the Route Handler", () => {
  const xml = sitemapEntriesToXml([
    { url: "https://dshpluginhub.ai/", changeFrequency: "weekly", priority: 1 },
    {
      url: "https://dshpluginhub.ai/plugins/acme&co",
      lastModified: "2026-08-20T00:00:00.000Z",
    },
  ]);
  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(xml, /xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9"/);
  assert.match(xml, /<urlset /);
  assert.match(xml, /<loc>https:\/\/dshpluginhub\.ai\/<\/loc>/);
  assert.match(xml, /<loc>https:\/\/dshpluginhub\.ai\/plugins\/acme&amp;co<\/loc>/);
  assert.match(xml, /<lastmod>2026-08-20T00:00:00\.000Z<\/lastmod>/);
  assert.equal(xml.includes("/report"), false);
});

test("slim sitemap parser keeps slugs when catalog items fail strict PluginSummary", () => {
  const result = parseSitemapPackageSearchResponse({
    items: [
      {
        slug: "hello-dsh",
        updatedAt: "2026-08-20T00:00:00.000Z",
        securityPassed: true,
        dailyDownloads: 12,
        dailyDownloadsDelta: 3,
        unexpectedExtra: "passthrough",
      },
      { displayName: "no slug here" },
      { slug: "second-plugin" },
    ],
    nextCursor: null,
    total: 3836,
  });

  assert.deepEqual(
    result.items.map((item) => item.slug),
    ["hello-dsh", "second-plugin"],
  );
  assert.equal(result.items[0]?.updatedAt, "2026-08-20T00:00:00.000Z");
  assert.equal(result.total, 3836);
});

test("continues paging when a page adds 0 slugs if total says more remain", async () => {
  const search: PackageSearch = async (_query, options) => {
    const page = options?.page ?? 1;
    if (page === 1) {
      return { items: [], nextCursor: null, total: 3 };
    }
    return {
      items: [plugin(1), plugin(2), plugin(3)],
      nextCursor: null,
      total: 3,
    };
  };

  const plugins = await listAllPackageSlugs(search);
  assert.equal(plugins.length, 3);
  assert.equal(plugins[0]?.slug, "plugin-0001");
});

test("listAllPackages slim-parses extra fields instead of dropping the slug", async () => {
  const search: PackageSearch = async () => ({
    items: [
      {
        slug: "quarantined-card",
        updatedAt: "2026-08-20T00:00:00.000Z",
        securityPassed: true,
        dailyDownloads: 0,
        dailyDownloadsDelta: 0,
      },
    ],
    nextCursor: null,
    total: 1,
  });

  const plugins = await listAllPackages(search);
  assert.deepEqual(
    plugins.map((item) => item.slug),
    ["quarantined-card"],
  );
});
