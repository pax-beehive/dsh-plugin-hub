import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const pluginPage = readFileSync(
  new URL("../app/(default)/plugins/page.tsx", import.meta.url),
  "utf8",
);

test("only exposes working plugin sort options", () => {
  assert.match(
    pluginPage,
    /const sortValues = \["popular", "updated"\] as const;/,
  );
  assert.doesNotMatch(pluginPage, /sortName|sort=name/);
});
