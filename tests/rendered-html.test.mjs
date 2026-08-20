import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

process.env.WORKOS_CLIENT_ID ??= "client_render_test";
process.env.WORKOS_API_KEY ??= "sk_test_render";
process.env.WORKOS_COOKIE_PASSWORD ??=
  "render-test-cookie-password-at-least-32-characters";
process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI ??= "http://localhost/callback";

async function render(pathname = "/", headers = {}) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${pathname}`, {
      headers: { accept: "text/html", ...headers },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
      WORKOS_CLIENT_ID: "client_render_test",
      WORKOS_API_KEY: "sk_test_render",
      WORKOS_COOKIE_PASSWORD: "render-test-cookie-password-at-least-32-characters",
      NEXT_PUBLIC_WORKOS_REDIRECT_URI: "http://localhost/callback",
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the Plugin Hub coming-soon page", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /^<!DOCTYPE html><html lang="zh-CN">/i);
  assert.match(
    html,
    /<title>DSH Plugin Hub — DeepSeek Harness 插件目录、Profiles 与安装社区<\/title>/i,
  );
  assert.match(html, /NOW LIVE/);
  assert.match(html, /Plugin Hub/);
  assert.match(html, /非官方社区项目/);
  assert.match(html, /为 Harness 插件生态而建的社区入口/);
  assert.match(html, /DeepSeek Harness Plugin Hub 是什么？/);
  assert.match(html, /href="\/plugins"/);
  assert.doesNotMatch(html, /waitlist-form|name="email"/);
  assert.match(html, /href="\/privacy"/);
  assert.match(
    html,
    /rel="canonical" href="https:\/\/dshpluginhub\.ai\/"/,
  );
  assert.match(html, /property="og:url" content="https:\/\/dshpluginhub\.ai\/"/);
  assert.match(html, /"@type":"WebSite"/);
  assert.match(html, /"@type":"FAQPage"/);
  assert.match(html, /rel="shortcut icon" href="\/favicon\.ico"/);
  assert.match(html, /rel="icon" href="\/favicon-64\.png"/);
  assert.match(
    html,
    /rel="alternate" type="text\/markdown" href="https:\/\/dshpluginhub\.ai\/index\.md"/,
  );
  assert.match(
    html,
    /rel="describedby" href="https:\/\/dshpluginhub\.ai\/llms\.txt"/,
  );
  assert.doesNotMatch(html, /codex-preview|Building your site/i);
});

test("server-renders English on the same URL from the locale cookie", async () => {
  const response = await render("/", { cookie: "dsh-hub-locale=en" });
  assert.equal(response.status, 200);

  const html = await response.text();
  assert.match(
    html,
    /<title>DSH Plugin Hub — DeepSeek Harness Plugins, Profiles &amp; Guides<\/title>/i,
  );
  assert.match(html, /^<!DOCTYPE html><html lang="en">/i);
  assert.match(html, /An open community hub to discover, share, and install Harness plugins/);
  assert.match(html, /What is DeepSeek Harness Plugin Hub\?/);
  assert.match(html, /rel="canonical" href="https:\/\/dshpluginhub\.ai\/"/);
  assert.match(html, /aria-pressed="true"[^>]*>EN<\/button>/i);
  assert.match(html, /"@id":"https:\/\/dshpluginhub\.ai\/#webpage"/);
});

test("legacy English URL stores the preference and redirects to the canonical URL", async () => {
  const response = await render("/en");
  assert.equal(response.status, 308);
  assert.equal(response.headers.get("location"), "http://localhost/");
  assert.match(response.headers.get("set-cookie") ?? "", /dsh-hub-locale=en/);
});

test("legacy English URL preserves paid-click query string", async () => {
  const response = await render("/en?gclid=abc&utm_source=google&oppref=op_1");
  assert.equal(response.status, 308);
  const location = response.headers.get("location") ?? "";
  assert.match(location, /https?:\/\/localhost\/\?/);
  assert.match(location, /gclid=abc/);
  assert.match(location, /utm_source=google/);
  assert.match(location, /oppref=op_1/);
  const cookies = typeof response.headers.getSetCookie === "function"
    ? response.headers.getSetCookie()
    : [response.headers.get("set-cookie") ?? ""];
  assert.ok(cookies.some((value) => /dsh-hub-locale=en/.test(value)));
  assert.ok(cookies.some((value) => /dsh-hub-attribution=/.test(value)));
});

test("privacy notice follows the same locale cookie", async () => {
  const response = await render("/privacy", { cookie: "dsh-hub-locale=en" });
  assert.equal(response.status, 200);

  const html = await response.text();
  assert.match(html, /How we handle your information/);
  assert.match(html, /What we collect/);
  assert.doesNotMatch(html, /我们如何处理你的信息/);
  assert.match(html, /hello@dshpluginhub\.ai/);
  assert.match(html, /rel="canonical" href="https:\/\/dshpluginhub\.ai\/privacy"/);
});

test("unsubscribe route is retired together with the waitlist", async () => {
  const response = await render("/unsubscribe?token=test-token");
  assert.equal(response.status, 404);
});

test("publishes crawl and AI discovery files with the canonical origin", async () => {
  const [llms, markdownHome, llmsFull, llmSingular] = await Promise.all([
    readFile(new URL("../public/llms.txt", import.meta.url), "utf8"),
    readFile(new URL("../public/index.md", import.meta.url), "utf8"),
    readFile(new URL("../public/llms-full.txt", import.meta.url), "utf8"),
    readFile(new URL("../public/llm.txt", import.meta.url), "utf8"),
  ]);

  assert.match(llms, /^# DeepSeek Harness Plugin Hub/m);
  assert.match(llms, /independent, unofficial community (project|registry)/i);
  assert.match(llms, /https:\/\/dshpluginhub\.ai\/index\.md/);
  assert.doesNotMatch(llms, /https:\/\/dshpluginhub\.ai\/en/);
  assert.match(llms, /https:\/\/github\.com\/deepseek-ai\/deepseek-harness/);
  assert.match(markdownHome, /## What you can do on the Hub today/);
  assert.match(markdownHome, /## Publishing a plugin/);
  assert.match(markdownHome, /Chinese and English share the canonical homepage URL/);
  assert.match(markdownHome, /not affiliated with, authorized by, or endorsed/i);
  assert.doesNotMatch(markdownHome, /waitlist|pre-release/i);
  assert.match(llmsFull, /## Frequently asked questions/);
  assert.match(llmsFull, /## Current capabilities \(live\)/);
  assert.doesNotMatch(llmsFull, /waitlist|pre-release/i);
  assert.match(llmSingular, /canonical llms\.txt/i);
  assert.match(llmSingular, /https:\/\/dshpluginhub\.ai\/llms\.txt/);
});

test("serves the vinext hydration manifest directly from Worker assets", async () => {
  const config = JSON.parse(
    await readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8"),
  );

  assert.deepEqual(config.assets.run_worker_first, [
    "/robots.txt",
    "/sitemap.xml",
    "/sitemap/*",
  ]);
});

test("homepage H1 includes the space and a site nav", async () => {
  const html = await (await render()).text();
  assert.match(html, /<h1>DeepSeek Harness\s+<span>Plugin Hub<\/span><\/h1>/);
  assert.match(html, /<nav class="site-nav"[^>]*>/);
  assert.match(html, /href="\/guides"/);
  assert.match(html, /href="\/profiles"/);
  assert.match(html, /href="\/status"/);
  assert.match(html, /class="brand" href="\/"/);
  assert.doesNotMatch(html, /class="brand" href="#top"/);
  assert.doesNotMatch(html, /DeepSeek HarnessPlugin Hub/);
});

test("status page self-canonicals and does not reuse the homepage og:url", async () => {
  const response = await render("/status");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /rel="canonical" href="https:\/\/dshpluginhub\.ai\/status"/);
  assert.match(html, /property="og:url" content="https:\/\/dshpluginhub\.ai\/status"/);
  assert.doesNotMatch(html, /rel="canonical" href="https:\/\/dshpluginhub\.ai\/"/);
  assert.doesNotMatch(
    html,
    /rel="alternate" type="text\/markdown" href="https:\/\/dshpluginhub\.ai\/index\.md"/,
  );
});

test("guides page does not advertise the homepage markdown alternate", async () => {
  const html = await (await render("/guides")).text();
  assert.match(html, /rel="canonical" href="https:\/\/dshpluginhub\.ai\/guides"/);
  assert.match(html, /property="og:url" content="https:\/\/dshpluginhub\.ai\/guides"/);
  assert.doesNotMatch(
    html,
    /rel="alternate" type="text\/markdown" href="https:\/\/dshpluginhub\.ai\/index\.md"/,
  );
  assert.match(html, /rel="describedby" href="https:\/\/dshpluginhub\.ai\/llms\.txt"/);
});

test("404 metadata is noindex only and does not reuse the homepage", async () => {
  const response = await render("/about");
  assert.equal(response.status, 404);
  const html = await response.text();
  assert.match(html, /name="robots" content="[^"]*noindex/);
  assert.doesNotMatch(html, /content="index, follow"/);
  assert.doesNotMatch(html, /content="index,follow"/);
  assert.doesNotMatch(html, /rel="canonical" href="https:\/\/dshpluginhub\.ai\/"/);
  assert.doesNotMatch(
    html,
    /<title>DSH Plugin Hub — DeepSeek Harness 插件目录、Profiles 与安装社区<\/title>/,
  );
  assert.doesNotMatch(html, /property="og:url" content="https:\/\/dshpluginhub\.ai\/"/);
});

test("indexable pages send a short public cache and auth stays no-store", async () => {
  const home = await render("/");
  assert.match(
    home.headers.get("cache-control") ?? "",
    /public,\s*s-maxage=60/,
  );
  const dashboard = await render("/dashboard");
  assert.match(dashboard.headers.get("cache-control") ?? "", /no-store/);
});
