import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("profile publish action keeps visible text and aligns with the draft action", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const rule = css.match(/\.profile-builder-submit \.dashboard-primary\s*\{([^}]+)\}/)?.[1] ?? "";

  assert.match(rule, /background:\s*#4653e6/);
  assert.match(rule, /color:\s*#fff/);
  assert.match(rule, /margin-top:\s*0/);
});
