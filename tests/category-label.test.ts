import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { categoryLabel } from "../lib/category-count-response.ts";

const agents = {
  name: "agents-orchestration",
  displayName: "Agents & Orchestration",
  displayNameZh: "智能体与编排",
  count: 0,
};

test("categoryLabel uses displayName for agents-orchestration, not the slug", () => {
  assert.equal(categoryLabel(agents, "en"), "Agents & Orchestration");
  assert.notEqual(categoryLabel(agents, "en"), "agents-orchestration");
  assert.equal(categoryLabel(agents, "zh"), "智能体与编排");
  assert.equal(
    categoryLabel({ name: "agents-orchestration", count: 0 }, "en"),
    "agents-orchestration",
  );
  assert.equal(
    categoryLabel({ name: "x", displayName: "X", count: 0 }, "zh"),
    "X",
  );
});

test("generateMetadata titles category pages with the display label", () => {
  const label = categoryLabel(agents, "en");
  const title = `${label} DSH plugins — verified manifests and exact versions`;
  assert.match(title, /Agents & Orchestration/);
  assert.ok(!title.startsWith("agents-orchestration"));
  assert.doesNotMatch(title, /^agents-orchestration/);

  const page = readFileSync(
    new URL("../app/(default)/categories/[category]/page.tsx", import.meta.url),
    "utf8",
  );
  assert.match(page, /export async function generateMetadata/);
  assert.match(page, /categoryLabel/);
  assert.match(page, /listCategories/);
  assert.match(page, /displayName|categoryLabel/);
  assert.match(page, /`\$\{label\} DSH plugins — verified manifests and exact versions`/);
  assert.doesNotMatch(page, /`\$\{category\} DSH plugins/);
  assert.doesNotMatch(page, /`\$\{category\} 类 DSH/);
  assert.match(page, /path: `\/categories\/\$\{encodeURIComponent\(category\)\}`/);
  assert.match(page, /t\.plugins\.categoryResult\(label\)/);
  assert.match(page, /\{categoryLabel\(entry, locale\)\}/);
  assert.doesNotMatch(page, />\s*\{entry\.name\}\s*</);
  assert.match(page, /href=\{`\/categories\/\$\{encodeURIComponent\(entry\.name\)\}`\}/);
});
