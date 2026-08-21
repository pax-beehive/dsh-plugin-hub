import assert from "node:assert/strict";
import test from "node:test";
import {
  PLUGIN_ICON_CACHE_CONTROL,
  PRIVATE_CACHE_CONTROL,
  PUBLIC_CACHE_CONTROL,
  cacheControlFor,
} from "../lib/cache-control.ts";

function request(path: string, method = "GET") {
  return new Request(`https://dshpluginhub.ai${path}`, { method });
}

test("indexable HTML gets a short public cache", () => {
  for (const path of ["/", "/plugins", "/guides", "/privacy", "/about"]) {
    assert.equal(cacheControlFor(request(path)), PUBLIC_CACHE_CONTROL);
  }
});

test("auth, API, collect, and report stay no-store", () => {
  for (const path of [
    "/dashboard",
    "/dashboard/plugins/hello",
    "/sign-in",
    "/callback",
    "/collect",
    "/api/v1/packages",
    "/report",
    "/integrations/github/install",
    "/auth/error",
  ]) {
    assert.equal(cacheControlFor(request(path)), PRIVATE_CACHE_CONTROL);
  }
});

test("non-GET report submissions are never cached", () => {
  assert.equal(cacheControlFor(request("/report", "POST")), PRIVATE_CACHE_CONTROL);
  assert.equal(cacheControlFor(request("/", "POST")), PRIVATE_CACHE_CONTROL);
});

test("same-origin plugin icons get a long immutable-origin edge cache", () => {
  assert.equal(
    cacheControlFor(
      request("/plugin-icons/gravatar/2a1454e724832f3b0d3b15c42b347401"),
    ),
    PLUGIN_ICON_CACHE_CONTROL,
  );
});
