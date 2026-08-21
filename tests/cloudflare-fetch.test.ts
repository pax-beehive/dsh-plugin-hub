import assert from "node:assert/strict";
import test from "node:test";
import { isPublicHubRead } from "../lib/cloudflare-fetch.ts";

test("only anonymous catalog GET endpoints are eligible for upstream caching", () => {
  for (const path of [
    "/api/v1/packages",
    "/api/v1/packages/plugin-slug",
    "/api/v1/profiles",
    "/api/v1/profiles/team-profile",
    "/api/v1/categories",
    "/api/v1/source-listings",
    "/api/v1/status",
  ]) {
    assert.equal(isPublicHubRead("GET", `https://api.dshpluginhub.ai${path}`), true);
  }

  for (const [method, path] of [
    ["POST", "/api/v1/packages/submit"],
    ["GET", "/api/v1/manage/plugins"],
    ["PATCH", "/api/v1/manage/plugins/slug"],
    ["POST", "/api/report"],
    ["GET", "/internal/identity/user"],
  ]) {
    assert.equal(
      isPublicHubRead(method, `https://api.dshpluginhub.ai${path}`),
      false,
    );
  }
});
