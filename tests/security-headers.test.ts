import assert from "node:assert/strict";
import test from "node:test";
import { withSecurityHeaders } from "../lib/security-headers.ts";

test("security headers prevent framing and allow the Turnstile runtime", async () => {
  const response = withSecurityHeaders(
    new Response("ok", { headers: { "content-type": "text/plain" } }),
  );

  assert.equal(response.headers.get("x-frame-options"), "DENY");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.match(
    response.headers.get("content-security-policy") ?? "",
    /frame-src https:\/\/challenges\.cloudflare\.com/,
  );
  assert.match(
    response.headers.get("content-security-policy") ?? "",
    /frame-ancestors 'none'/,
  );
  assert.equal(await response.text(), "ok");
});

test("security headers allow optional Google and ChatGPT Ads pixels", async () => {
  const response = withSecurityHeaders(new Response("ok"));
  const csp = response.headers.get("content-security-policy") ?? "";

  assert.match(csp, /script-src[^;]*https:\/\/www\.googletagmanager\.com/);
  assert.match(csp, /script-src[^;]*https:\/\/www\.google-analytics\.com/);
  assert.match(csp, /script-src[^;]*https:\/\/bzrcdn\.openai\.com/);
  assert.match(csp, /connect-src[^;]*https:\/\/www\.google-analytics\.com/);
  assert.match(csp, /connect-src[^;]*https:\/\/www\.googleadservices\.com/);
  assert.match(csp, /connect-src[^;]*https:\/\/www\.googletagmanager\.com/);
  assert.match(csp, /connect-src[^;]*https:\/\/bzr\.openai\.com/);
  assert.match(csp, /connect-src[^;]*https:\/\/bzrcdn\.openai\.com/);
  assert.match(csp, /img-src[^;]*https:\/\/www\.google-analytics\.com/);
  assert.match(csp, /img-src[^;]*https:\/\/www\.googleadservices\.com/);
  assert.match(csp, /img-src[^;]*https:\/\/www\.googletagmanager\.com/);
  assert.match(csp, /img-src[^;]*https:\/\/bzr\.openai\.com/);
  assert.match(csp, /img-src[^;]*https:\/\/www\.google\.com/);
});

test("security headers set a short public cache on indexable pages", async () => {
  const response = withSecurityHeaders(
    new Response("ok"),
    new Request("https://dshpluginhub.ai/plugins"),
  );
  assert.equal(
    response.headers.get("cache-control"),
    "public, s-maxage=60, stale-while-revalidate=300",
  );
  assert.match(response.headers.get("vary") ?? "", /Cookie/);
  assert.equal(response.headers.get("x-frame-options"), "DENY");
});

test("security headers keep dashboard and report POST uncached", async () => {
  const dashboard = withSecurityHeaders(
    new Response("ok"),
    new Request("https://dshpluginhub.ai/dashboard"),
  );
  assert.equal(dashboard.headers.get("cache-control"), "no-store");

  const reportPost = withSecurityHeaders(
    new Response("ok"),
    new Request("https://dshpluginhub.ai/report", { method: "POST" }),
  );
  assert.equal(reportPost.headers.get("cache-control"), "no-store");
});
