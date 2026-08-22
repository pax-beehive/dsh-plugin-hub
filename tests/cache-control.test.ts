import assert from "node:assert/strict";
import test from "node:test";
import {
  HUB_API_NOT_FOUND_CACHE_CONTROL,
  HUB_API_SUCCESS_CACHE_CONTROL,
  PLUGIN_ICON_CACHE_CONTROL,
  PRIVATE_CACHE_CONTROL,
  SEARCH_HTML_CACHE_CONTROL,
  STABLE_HTML_CACHE_CONTROL,
  applyCacheHeaders,
  cacheControlFor,
  cachePolicyFor,
} from "../lib/cache-control.ts";

function request(path: string, method = "GET") {
  return new Request(`https://dshpluginhub.ai${path}`, { method });
}

test("stable anonymous pages and catalog detail use a 300s public cache", () => {
  for (const path of [
    "/",
    "/plugins",
    "/plugins/memory",
    "/profiles",
    "/profiles/team-web",
    "/status",
    "/docs",
    "/docs/first-plugin",
    "/privacy",
    "/about",
  ]) {
    assert.equal(cacheControlFor(request(path)), STABLE_HTML_CACHE_CONTROL);
    assert.equal(cachePolicyFor(request(path)), "stable-html");
  }
});

test("search, sort, and pagination variants use a shorter 120s cache", () => {
  for (const path of [
    "/plugins?q=memory",
    "/plugins?page=2",
    "/plugins?sort=updated",
    "/profiles?q=team",
  ]) {
    assert.equal(cacheControlFor(request(path)), SEARCH_HTML_CACHE_CONTROL);
    assert.equal(cachePolicyFor(request(path)), "search-html");
  }
});

test("auth, dashboard, collect, mutations, and private APIs stay no-store", () => {
  for (const path of [
    "/dashboard",
    "/dashboard/plugins/hello",
    "/sign-in",
    "/callback",
    "/collect",
    "/api/v1/manage/plugins",
    "/report",
    "/integrations/github/install",
    "/auth/error",
  ]) {
    assert.equal(cacheControlFor(request(path)), PRIVATE_CACHE_CONTROL);
    assert.equal(cachePolicyFor(request(path)), "no-store");
  }
});

test("signed-in public pages are never stored in a shared cache", () => {
  const signedIn = new Request("https://dshpluginhub.ai/plugins", {
    headers: { cookie: "dsh-hub-locale=en; wos-session=sealed" },
  });
  assert.equal(cacheControlFor(signedIn), PRIVATE_CACHE_CONTROL);
  assert.equal(cachePolicyFor(signedIn), "no-store");
});

test("successful public Hub API reads cache for 300s and 404s for 30s", () => {
  const packages = request("/api/v1/packages");
  assert.equal(cacheControlFor(packages, 200), HUB_API_SUCCESS_CACHE_CONTROL);
  assert.equal(cachePolicyFor(packages, 200), "hub-api");
  assert.equal(cacheControlFor(packages, 404), HUB_API_NOT_FOUND_CACHE_CONTROL);
  assert.equal(cachePolicyFor(packages, 404), "hub-api-404");
  assert.equal(cacheControlFor(packages, 502), PRIVATE_CACHE_CONTROL);
  assert.equal(cachePolicyFor(packages, 502), "no-store");
});

test("non-GET report submissions are never cached", () => {
  assert.equal(cacheControlFor(request("/report", "POST")), PRIVATE_CACHE_CONTROL);
  assert.equal(cacheControlFor(request("/", "POST")), PRIVATE_CACHE_CONTROL);
});

test("same-origin plugin icons keep the long 30d edge cache", () => {
  assert.equal(
    cacheControlFor(
      request("/plugin-icons/gravatar/2a1454e724832f3b0d3b15c42b347401"),
    ),
    PLUGIN_ICON_CACHE_CONTROL,
  );
  assert.equal(
    cachePolicyFor(
      request("/plugin-icons/gravatar/2a1454e724832f3b0d3b15c42b347401"),
    ),
    "plugin-icon",
  );
});

test("public HTML responses expose the cache-policy identifier", () => {
  const headers = new Headers();
  applyCacheHeaders(headers, request("/plugins"));
  assert.equal(headers.get("x-dsh-cache-policy"), "stable-html");
  assert.equal(headers.get("cache-control"), STABLE_HTML_CACHE_CONTROL);
  assert.match(headers.get("vary") ?? "", /Cookie/);
  assert.match(headers.get("vary") ?? "", /Accept-Language/);

  const search = new Headers();
  applyCacheHeaders(search, request("/plugins?q=memory"));
  assert.equal(search.get("x-dsh-cache-policy"), "search-html");
});
