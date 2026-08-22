import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const dashboard = readFileSync(new URL("../app/dashboard/page.tsx", import.meta.url), "utf8");

test("dashboard exposes both Profile creation paths", () => {
  assert.match(dashboard, /PROFILE CREATION/);
  assert.match(dashboard, /profile share my-profile --version 1\.0\.0 --profile web/);
  assert.match(dashboard, /href="\/dashboard\/profiles\/new"/);
  assert.match(dashboard, /purpose="profile-share"/);
});
