import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const files = {
  icon: new URL("../components/PluginIcon.tsx", import.meta.url),
  header: new URL("../components/HubHeader.tsx", import.meta.url),
  plugins: new URL("../app/(default)/plugins/page.tsx", import.meta.url),
  category: new URL("../app/(default)/categories/[category]/page.tsx", import.meta.url),
  profiles: new URL("../app/(default)/profiles/page.tsx", import.meta.url),
  docs: new URL("../app/(default)/docs/page.tsx", import.meta.url),
  doc: new URL("../app/(default)/docs/[slug]/page.tsx", import.meta.url),
};

async function source(key) {
  return readFile(files[key], "utf8");
}

function linkOpenings(sourceText) {
  return sourceText.match(/<Link\b[\s\S]*?>/g) ?? [];
}

function linksContaining(sourceText, snippet) {
  return linkOpenings(sourceText).filter((tag) => tag.includes(snippet));
}

function assertPrefetchDisabled(tags, label) {
  assert.ok(tags.length > 0, `expected at least one ${label}`);
  for (const tag of tags) {
    assert.match(tag, /prefetch=\{false\}/, `${label} missing prefetch={false}: ${tag}`);
  }
}

test("catalog plugin cards, category chips, and pagination disable prefetch", async () => {
  const [plugins, category] = await Promise.all([source("plugins"), source("category")]);

  assertPrefetchDisabled(linksContaining(plugins, "plugin-card"), "plugin-card");
  assertPrefetchDisabled(linksContaining(category, "plugin-card"), "category plugin-card");
  assertPrefetchDisabled(linksContaining(plugins, "pagination-link"), "pagination-link");
  assertPrefetchDisabled(
    linksContaining(plugins, "/categories/${encodeURIComponent(entry.name)}"),
    "plugins category chip",
  );
  assertPrefetchDisabled(
    linksContaining(category, "/categories/${encodeURIComponent(entry.name)}"),
    "category chip",
  );
});

test("profile cards and guide cards disable prefetch", async () => {
  const [profiles, docs, doc] = await Promise.all([
    source("profiles"),
    source("docs"),
    source("doc"),
  ]);

  assertPrefetchDisabled(linksContaining(profiles, "profile-card"), "profile-card");
  assertPrefetchDisabled(linksContaining(docs, "docs-card"), "docs-card");
  assertPrefetchDisabled(
    linksContaining(docs, "/docs/${featured.slug}"),
    "featured guide card",
  );
  assertPrefetchDisabled(
    linksContaining(doc, "/docs/${item.slug}"),
    "guide catalog link",
  );
});

test("HubHeader keeps default prefetch on primary nav routes", async () => {
  const header = await source("header");
  assert.match(header, /<Link href="\/plugins">\{t\.nav\.plugins\}<\/Link>/);
  assert.match(header, /<Link href="\/profiles">\{t\.nav\.profiles\}<\/Link>/);
  assert.match(header, /<Link href="\/docs">\{t\.nav\.docs\}<\/Link>/);
  assert.match(header, /<Link className="hub-publish-link" href="\/dashboard">/);
  assert.doesNotMatch(header, /prefetch=\{false\}/);
});

test("plugin icons are dimensioned lazy images behind the same-origin proxy", async () => {
  const icon = await source("icon");
  assert.match(icon, /pluginIconUrl\(iconUrl\)/);
  assert.match(icon, /loading=\{eager \? "eager" : "lazy"\}/);
  assert.match(icon, /fetchPriority=\{eager \? "high" : "low"\}/);
  assert.match(icon, /width=\{size\}/);
  assert.match(icon, /height=\{size\}/);
  assert.match(icon, /"plugin-icon": 42/);
  assert.match(icon, /"detail-icon": 68/);
  assert.match(icon, /onError=\{\(\) => setFailed\(true\)\}/);
  assert.doesNotMatch(icon, /www\.gravatar\.com|secure\.gravatar\.com/);
});
