import assert from "node:assert/strict";
import test from "node:test";
import {
  isCacheablePublicHtmlResponse,
  isPublicHtmlCacheRequest,
  publicPageCacheKey,
  requestLocale,
  withEdgeDiagnostics,
} from "../lib/edge-cache.ts";

function htmlRequest(path: string, headers: HeadersInit = {}) {
  return new Request(`https://dshpluginhub.ai${path}`, {
    headers: { accept: "text/html", ...headers },
  });
}

test("public HTML cache varies only on rendered query fields and locale", () => {
  const request = htmlRequest(
    "/plugins?utm_source=ads&q=memory&sort=updated&page=2&noise=ignored",
    { cookie: "analytics=1; dsh-hub-locale=en" },
  );
  const key = new URL(publicPageCacheKey(request).url);

  assert.equal(requestLocale(request), "en");
  assert.equal(
    key.search,
    "?__dsh_locale=en&page=2&q=memory&sort=updated",
  );
});

test("public HTML cache normalizes query values exactly like the pages", () => {
  const noisy = htmlRequest(
    `/plugins?q=${encodeURIComponent(`  ${"x".repeat(140)}  `)}&page=-8&sort=popular`,
  );
  const key = new URL(publicPageCacheKey(noisy).url);

  assert.equal(key.searchParams.get("q"), "x".repeat(120));
  assert.equal(key.searchParams.has("page"), false);
  assert.equal(key.searchParams.has("sort"), false);
});

test("public cache excludes auth, private paths, RSC, prefetch, and mutations", () => {
  assert.equal(isPublicHtmlCacheRequest(htmlRequest("/plugins")), true);
  assert.equal(
    isPublicHtmlCacheRequest(
      htmlRequest("/plugins", { cookie: "wos-session=sealed" }),
    ),
    false,
  );
  assert.equal(isPublicHtmlCacheRequest(htmlRequest("/dashboard")), false);
  assert.equal(
    isPublicHtmlCacheRequest(htmlRequest("/plugins", { rsc: "1" })),
    false,
  );
  assert.equal(
    isPublicHtmlCacheRequest(htmlRequest("/plugins", { purpose: "prefetch" })),
    false,
  );
  assert.equal(
    isPublicHtmlCacheRequest(
      new Request("https://dshpluginhub.ai/plugins", {
        headers: { accept: "text/html" },
        method: "POST",
      }),
    ),
    false,
  );
});

test("only successful cookie-free HTML responses populate the public cache", () => {
  assert.equal(
    isCacheablePublicHtmlResponse(
      new Response("<h1>ok</h1>", {
        headers: { "content-type": "text/html; charset=utf-8" },
      }),
    ),
    true,
  );
  assert.equal(
    isCacheablePublicHtmlResponse(
      new Response("<h1>private</h1>", {
        headers: {
          "content-type": "text/html",
          "set-cookie": "session=secret",
        },
      }),
    ),
    false,
  );
});

test("edge diagnostics preserve the response and expose cache timing", async () => {
  const response = withEdgeDiagnostics(new Response("ok"), "HIT", 12.34);
  assert.equal(response.headers.get("x-dsh-edge-cache"), "HIT");
  assert.match(response.headers.get("server-timing") ?? "", /worker;dur=12\.3/);
  assert.match(response.headers.get("server-timing") ?? "", /edge-cache;desc="hit"/);
  assert.equal(await response.text(), "ok");
});
