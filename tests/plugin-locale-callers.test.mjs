import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const files = {
  catalog: new URL("../app/(default)/plugins/page.tsx", import.meta.url),
  detail: new URL("../app/(default)/plugins/[slug]/page.tsx", import.meta.url),
  category: new URL("../app/(default)/categories/[category]/page.tsx", import.meta.url),
  categories: new URL("../app/(default)/categories/page.tsx", import.meta.url),
};

test("localized catalog callers pass their resolved locale to package searches", async () => {
  const [catalog, category, categories] = await Promise.all([
    readFile(files.catalog, "utf8"),
    readFile(files.category, "utf8"),
    readFile(files.categories, "utf8"),
  ]);

  assert.match(catalog, /searchPackages\(q, \{\s+locale,/);
  assert.match(catalog, /searchPackages\(q, \{ locale, sort, page, limit: pageSize \}\)/);
  assert.match(category, /searchPackages\("", \{ category, limit: 60, locale \}\)/);
  assert.match(categories, /safeSearchPackages\("", \{ locale, limit: 1 \}\)/);
  assert.match(categories, /safeSearchPackages\("", \{ locale, limit: 60 \}\)/);
});

test("plugin metadata resolves locale before fetching localized plugin content", async () => {
  const detail = await readFile(files.detail, "utf8");
  const metadata = detail.slice(
    detail.indexOf("export async function generateMetadata"),
    detail.indexOf("export default async function PluginDetailPage"),
  );

  const localeIndex = metadata.indexOf("const locale = await getHubLocale();");
  const pluginIndex = metadata.indexOf("const plugin = await getPlugin((await params).slug, locale);");
  assert.ok(localeIndex >= 0);
  assert.ok(pluginIndex > localeIndex);
  assert.doesNotMatch(metadata, /getPlugin\(\(await params\)\.slug\)(?!,)/);
  assert.match(detail, /return getPackageBySlug\(slug, locale\)/);
});
