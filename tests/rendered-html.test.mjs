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
  assert.match(html, /class="hub-header"/);
  assert.match(html, /href="\/sign-in" class="hub-signin-link">登录<\/a>/);
  assert.doesNotMatch(html, /waitlist-form|name="email"/);
  assert.match(html, /href="\/privacy"/);
  assert.match(html, /class="hub-footer"/);
  assert.match(html, /href="mailto:hello@dshpluginhub\.ai"/);
  assert.match(html, /href="https:\/\/github\.com\/pax-beehive\/dsh-plugin-hub"/);
  assert.match(
    html,
    /rel="canonical" href="https:\/\/dshpluginhub\.ai\/?"/,
  );
  assert.match(html, /property="og:url" content="https:\/\/dshpluginhub\.ai\/?"/);
  assert.match(html, /"@type":"WebSite"/);
  assert.match(html, /"@type":"FAQPage"/);
  assert.match(html, /rel="shortcut icon" href="\/deepseek-whale-black\.svg\?v=2"/);
  assert.match(html, /rel="icon" href="\/deepseek-whale-black\.svg\?v=2"/);
  assert.match(
    html,
    /rel="alternate" href="https:\/\/dshpluginhub\.ai\/index\.md" type="text\/markdown"/,
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
  assert.match(html, /class="hub-header"/);
  assert.match(html, /href="\/sign-in" class="hub-signin-link">Sign in<\/a>/);
  assert.match(html, /rel="canonical" href="https:\/\/dshpluginhub\.ai\/?"/);
  assert.match(html, /aria-pressed="true"[^>]*>EN<\/button>/i);
  assert.match(html, /"@id":"https:\/\/dshpluginhub\.ai\/#webpage"/);
});

test("catalog header includes the shared sign-in action", async () => {
  const [header, logo, styles] = await Promise.all([
    readFile(new URL("../components/HubHeader.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/BrandLogo.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(header, /<BrandLogo \/>/);
  assert.match(header, /className="hub-signin-link" href="\/sign-in"/);
  assert.match(header, /t\.nav\.signIn/);
  assert.match(header, /export function DashboardHeader/);
  assert.match(header, /<HeaderChrome homeHref="\/dashboard" locale=\{locale\}>/);
  assert.match(logo, /src="\/deepseek-whale-black\.svg"/);
  assert.match(styles, /padding: 13px max\(20px, calc\(50% - 590px\)\)/);
  assert.match(styles, /\.catalog-section \{\s+width: min\(1180px, calc\(100% - 40px\)\)/);
});

test("publisher pages use the shared header chrome", async () => {
  const [dashboard, editor, authError] = await Promise.all([
    readFile(new URL("../app/dashboard/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/plugins/[slug]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/(default)/auth/error/page.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(dashboard, /<DashboardHeader locale=\{locale\} \/>/);
  assert.match(editor, /<DashboardHeader/);
  assert.match(authError, /<HubHeader locale=\{locale\} \/>/);
  for (const source of [dashboard, editor, authError]) {
    assert.doesNotMatch(source, /dashboard-header|brand-mark/);
  }
});

test("public and dashboard layouts share the black whale favicon", async () => {
  const [icons, document, publicLayout, dashboardLayout] = await Promise.all([
    readFile(new URL("../lib/site-icons.ts", import.meta.url), "utf8"),
    readFile(new URL("../components/SiteDocument.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/(default)/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/layout.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(icons, /deepseek-whale-black\.svg\?v=2/);
  assert.match(icons, /shortcut: whaleIcon/);
  assert.match(document, /rel="icon"/);
  assert.match(document, /rel="shortcut icon"/);
  assert.match(document, /deepseek-whale-black\.svg\?v=2/g);
  assert.match(publicLayout, /icons: siteIcons/);
  assert.match(dashboardLayout, /icons: siteIcons/);
});

test("homepage hero entry animates without forcing motion", async () => {
  const styles = await readFile(
    new URL("../app/globals.css", import.meta.url),
    "utf8",
  );

  assert.match(styles, /\.hero-actions \.hub-entry-link:hover/);
  assert.match(styles, /background: var\(--blue\)/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /\.hero-actions \.hub-entry-link \{\s+transition: none;/);
});

test("plugin catalog and details render backend-provided icon URLs", async () => {
  const [component, catalog, category, detail] = await Promise.all([
    readFile(new URL("../components/PluginIcon.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/(default)/plugins/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/(default)/categories/[category]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/(default)/plugins/[slug]/page.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(component, /const src = pluginIconUrl\(iconUrl\)/);
  assert.match(component, /src=\{src\}/);
  assert.match(component, /onError=\{\(\) => setFailed\(true\)\}/);
  for (const source of [catalog, category, detail]) {
    assert.match(source, /<PluginIcon/);
    assert.match(source, /iconUrl=\{plugin\.iconUrl\}/);
  }
});

test("plugin details collapse versions after the newest three", async () => {
  const [detail, styles, i18n] = await Promise.all([
    readFile(new URL("../app/(default)/plugins/[slug]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../lib/i18n.ts", import.meta.url), "utf8"),
  ]);

  assert.match(detail, /versionRows\.slice\(0, 3\)/);
  assert.match(detail, /<details className="version-overflow">/);
  assert.match(detail, /versionRows\.slice\(3\)/);
  assert.doesNotMatch(detail, /<details className="version-overflow" open/);
  assert.match(styles, /\.version-overflow\[open\] \.version-toggle-less/);
  assert.match(i18n, /showMoreVersions/);
  assert.match(i18n, /hideVersions/);
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
  assert.match(
    html,
    /<h1>DeepSeek Harness(?:<!-- -->)?\s+<span>Plugin Hub<\/span><\/h1>/,
  );
  assert.match(html, /<nav class="hub-nav"[^>]*>/);
  assert.match(html, /href="\/guides"/);
  assert.match(html, /href="\/profiles"/);
  assert.match(
    html,
    /<a(?=[^>]*class="brand")(?=[^>]*href="\/")[^>]*>/,
  );
  assert.doesNotMatch(html, /class="brand" href="#top"/);
  assert.doesNotMatch(html, /DeepSeek HarnessPlugin Hub/);
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
