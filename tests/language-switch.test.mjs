import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const switchSource = readFileSync(
  new URL("../components/LanguageSwitch.tsx", import.meta.url),
  "utf8",
);
const home = readFileSync(
  new URL("../components/HomePage.tsx", import.meta.url),
  "utf8",
);

test("language toggle sets the locale cookie and reloads in place", () => {
  assert.match(switchSource, /HUB_LOCALE_COOKIE/);
  assert.match(switchSource, /window\.location\.reload\(\)/);
  assert.doesNotMatch(switchSource, /href=["']\/zh/);
  assert.doesNotMatch(switchSource, /\/zh["']/);
  assert.doesNotMatch(home, /href=["']\/zh/);
});

test("retired /publish hrefs redirect to sign-in", () => {
  const route = readFileSync(new URL("../app/publish/route.ts", import.meta.url), "utf8");
  const header = readFileSync(new URL("../components/HubHeader.tsx", import.meta.url), "utf8");
  const home = readFileSync(new URL("../components/HomePage.tsx", import.meta.url), "utf8");
  assert.match(route, /redirect\(["']\/sign-in["']\)/);
  assert.doesNotMatch(header, /href=["']\/publish["']/);
  assert.doesNotMatch(home, /href=["']\/publish["']/);
});
