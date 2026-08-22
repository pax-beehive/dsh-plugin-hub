import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const pluginPage = readFileSync(
  new URL("../app/(default)/plugins/page.tsx", import.meta.url),
  "utf8",
);
const i18n = readFileSync(
  new URL("../lib/i18n.ts", import.meta.url),
  "utf8",
);

test("exposes the backend popular, rising, and updated sort orders", () => {
  assert.match(
    pluginPage,
    /const sortValues = \["popular", "rising", "updated"\] as const;/,
  );
  assert.match(pluginPage, /popular: t\.plugins\.sortPopular/);
  assert.match(pluginPage, /rising: t\.plugins\.sortRising/);
  assert.match(pluginPage, /updated: t\.plugins\.sortUpdated/);
  assert.match(i18n, /sortPopular: "热门"/);
  assert.match(i18n, /sortPopular: "Popular"/);
  assert.match(i18n, /sortRising: "上升最快"/);
  assert.match(i18n, /sortRising: "Rising"/);
  assert.doesNotMatch(pluginPage, /sortWeekly|sortByWeeklyDownloads|apiSort/);
  assert.doesNotMatch(pluginPage, /sortName|sort=name/);
});
