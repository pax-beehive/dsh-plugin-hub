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
  assert.match(html, /^<!DOCTYPE html><html lang="en">/i);
  assert.match(
    html,
    /<title>DSH plugin registry — exact versions, manifests, one-command installs<\/title>/i,
  );
  assert.match(html, /NOW LIVE/);
  assert.match(html, /Plugin Hub/);
  assert.match(html, /unofficial community project/i);
  assert.match(html, /A community entry point for the Harness plugin ecosystem/);
  assert.match(html, /What is the DSH plugin registry?/);
  assert.match(html, /href="\/plugins"/);
  assert.match(html, /class="hub-header"/);
  assert.match(html, /href="\/sign-in" class="hub-signin-link">Sign in<\/a>/);
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

test("server-renders Chinese when Accept-Language prefers Chinese", async () => {
  const response = await render("/", { "accept-language": "zh-CN,zh;q=0.9,en;q=0.8" });
  assert.equal(response.status, 200);

  const html = await response.text();
  assert.match(html, /^<!DOCTYPE html><html lang="zh-CN">/i);
  assert.match(
    html,
    /<title>DSH 插件注册表 — 精确版本、manifest 与一键安装<\/title>/i,
  );
  assert.match(html, /非官方社区项目/);
  assert.match(html, /为 Harness 插件生态而建的社区入口/);
  assert.match(html, /DSH 插件注册表是什么？/);
});

test("server-renders Chinese when the locale cookie is zh", async () => {
  const response = await render("/", {
    cookie: "dsh-hub-locale=zh",
    "accept-language": "en-US,en;q=0.9",
  });
  assert.equal(response.status, 200);

  const html = await response.text();
  assert.match(html, /^<!DOCTYPE html><html lang="zh-CN">/i);
  assert.match(html, /DSH 插件注册表是什么？/);
});

test("server-renders English on the same URL from the locale cookie", async () => {
  const response = await render("/", { cookie: "dsh-hub-locale=en" });
  assert.equal(response.status, 200);

  const html = await response.text();
  assert.match(
    html,
    /<title>DSH plugin registry — exact versions, manifests, one-command installs<\/title>/i,
  );
  assert.match(html, /^<!DOCTYPE html><html lang="en">/i);
  assert.match(html, /Exact versions, verified manifests, and one-command installs for DeepSeek Harness plugins/);
  assert.match(html, /What is the DSH plugin registry?/);
  assert.match(html, /class="hub-header"/);
  assert.match(html, /href="\/sign-in" class="hub-signin-link">Sign in<\/a>/);
  assert.match(html, /rel="canonical" href="https:\/\/dshpluginhub\.ai\/?"/);
  assert.match(html, /aria-pressed="true"[^>]*>EN<\/button>/i);
  assert.match(html, /"@id":"https:\/\/dshpluginhub\.ai\/#webpage"/);
});

test("catalog header includes the shared sign-in action", async () => {
  const [header, accountMenu, logo, styles] = await Promise.all([
    readFile(new URL("../components/HubHeader.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/UserAccountMenu.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/BrandLogo.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(header, /<BrandLogo \/>/);
  assert.match(header, /className="hub-signin-link" href="\/sign-in"/);
  assert.match(header, /t\.nav\.signIn/);
  assert.match(header, /<UserAccountMenu account=\{account\} locale=\{locale\} \/>/);
  assert.match(accountMenu, /className="hub-account-name"/);
  assert.match(accountMenu, /\{account\.displayName\}/);
  assert.match(accountMenu, /document\.addEventListener\("focusin", closeWhenOutside\)/);
  assert.match(accountMenu, /document\.addEventListener\("keydown", closeOnEscape\)/);
  assert.match(accountMenu, /document\.addEventListener\("pointerdown", closeWhenOutside\)/);
  assert.match(accountMenu, /removeAttribute\("open"\)/);
  assert.match(accountMenu, /event\.key === "Escape"/);
  assert.match(accountMenu, /href="\/sign-out"/);
  assert.match(accountMenu, /<UserAvatar/);
  assert.match(header, /export function DashboardHeader/);
  assert.match(header, /<HeaderChrome homeHref="\/dashboard" locale=\{locale\}>/);
  assert.match(logo, /src="\/deepseek-whale-black\.svg"/);
  assert.match(styles, /\/\* Sticky floating glass header\. \*\//);
  assert.match(styles, /width: min\(1240px, calc\(100% - 24px\)\)/);
  assert.match(styles, /border-radius: 18px/);
  assert.match(styles, /backdrop-filter: saturate\(155%\) blur\(20px\)/);
  assert.match(styles, /0 20px 50px rgb\(22 30 70 \/ 10%\)/);
  assert.match(styles, /\.catalog-section \{\s+width: min\(1180px, calc\(100% - 40px\)\)/);
});

test("plugin results use a unified, responsive section header", async () => {
  const [page, styles] = await Promise.all([
    readFile(new URL("../app/(default)/plugins/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(page, /className="catalog-results-header"/);
  assert.match(page, /catalog-results-header[\s\S]*catalog-section-heading[\s\S]*sort-tabs/);
  assert.doesNotMatch(page, /plugin\.categories\.slice/);
  assert.match(styles, /\.catalog-results-header \{[\s\S]*justify-content: space-between/);
  assert.match(styles, /@media \(max-width: 680px\) \{[\s\S]*\.catalog-results-header \{[\s\S]*flex-direction: column/);
});

test("category index uses quick links and a compact responsive directory", async () => {
  const [page, categoryIcon, styles] = await Promise.all([
    readFile(new URL("../app/(default)/categories/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/CategoryIcon.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(page, /className="category-rail category-index-rail"/);
  assert.match(page, /className="category-directory-grid"/);
  assert.match(page, /className="category-directory-card"/);
  assert.match(page, /<CategoryIcon category=\{entry\.name\} \/>/);
  assert.doesNotMatch(page, /category-directory-mark[^>]*>\s*#/);
  for (const category of [
    "agents-orchestration",
    "memory-context",
    "developer-tools",
    "ui-customization",
    "integrations-communication",
    "vision-media",
    "search-research",
    "security-access",
    "models-usage",
    "productivity-workflow",
  ]) {
    assert.match(categoryIcon, new RegExp(`"${category}"`));
    assert.match(styles, new RegExp(`data-category="${category}"`));
  }
  assert.match(page, /loadCategoryPreviews\(categories, locale, PREVIEW_LIMIT\)/);
  assert.doesNotMatch(page, /className="category-index-block"/);
  assert.match(styles, /\.category-directory-grid \{[\s\S]*grid-template-columns: repeat\(3/);
  assert.match(styles, /@media \(max-width: 560px\) \{[\s\S]*\.category-directory-grid \{[\s\S]*grid-template-columns: 1fr/);
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
  const [component, catalog, category, categoriesIndex, detail] = await Promise.all([
    readFile(new URL("../components/PluginIcon.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/(default)/plugins/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/(default)/categories/[category]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/(default)/categories/page.tsx", import.meta.url), "utf8"),
        readFile(new URL("../app/(default)/plugins/[slug]/page.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(component, /const src = pluginIconUrl\(iconUrl\)/);
  assert.match(component, /src=\{src\}/);
  assert.match(component, /onError=\{\(\) => setFailed\(true\)\}/);
  assert.match(component, /loading=\{eager \? "eager" : "lazy"\}/);
  assert.match(component, /fetchPriority=\{eager \? "high" : "low"\}/);
  assert.match(component, /width=\{size\}/);
  assert.match(component, /height=\{size\}/);
  assert.doesNotMatch(component, /gravatar\.com/);
  for (const source of [catalog, category, categoriesIndex, detail]) {
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

  assert.match(detail, /partitionVersionRows/);
  assert.match(detail, /versionChannelLabel/);
  assert.match(detail, /descriptionsAreDuplicate/);
  assert.match(detail, /<details className="version-overflow">/);
  assert.match(detail, /hiddenVersionRows/);
  assert.match(detail, /pinInstallSpec/);
  assert.doesNotMatch(detail, /latest\.source\.installSpec/);
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
    /<h1>DeepSeek Harness(?:<!-- -->)?\s+<span>plugin registry<\/span><\/h1>/,
  );
  assert.match(html, /<nav class="hub-nav"[^>]*>/);
  assert.match(html, /href="\/docs"/);
  assert.doesNotMatch(html, /href="\/status"/);
  assert.doesNotMatch(html, /href="\/profiles"/);
  assert.match(
    html,
    /<a(?=[^>]*class="brand")(?=[^>]*href="\/")[^>]*>/,
  );
  assert.doesNotMatch(html, /class="brand" href="#top"/);
  assert.doesNotMatch(html, /DeepSeek Harnessplugin registry/);
});

test("removed status page returns not found", async () => {
  const response = await render("/status");
  assert.equal(response.status, 404);
  const html = await response.text();
  assert.match(html, /Not found/i);
  assert.doesNotMatch(html, /dshpluginhub\.ai\/status/);
});

test("docs page does not advertise the homepage markdown alternate", async () => {
  const html = await (await render("/docs")).text();
  assert.match(html, /rel="canonical" href="https:\/\/dshpluginhub\.ai\/docs"/);
  assert.match(html, /property="og:url" content="https:\/\/dshpluginhub\.ai\/docs"/);
  assert.match(html, /Build with confidence/);
  assert.match(html, /href="\/docs\/first-plugin"/);
  assert.match(html, /Documentation/);
  assert.doesNotMatch(
    html,
    /rel="alternate" type="text\/markdown" href="https:\/\/dshpluginhub\.ai\/index\.md"/,
  );
  assert.match(html, /rel="describedby" href="https:\/\/dshpluginhub\.ai\/llms\.txt"/);
});

test("docs landing uses focused paths and readable document rows", async () => {
  const [page, styles] = await Promise.all([
    readFile(new URL("../app/(default)/docs/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(styles, /--docs-ui-size: 14px;/);
  assert.match(styles, /--docs-body-size: 16px;/);
  assert.match(styles, /--docs-section-title-size: 26px;/);
  assert.match(styles, /--font-hub-sans: "Geist", "Geist Fallback", -apple-system,/);
  assert.match(styles, /body \{[\s\S]*font-family: var\(--font-hub-sans\);/);
  assert.match(styles, /\.docs-site:lang\(zh-CN\) \{[\s\S]*"PingFang SC"[\s\S]*"Noto Sans CJK SC"/);
  assert.match(styles, /\.docs-sidebar-group a \{[\s\S]*font-size: var\(--docs-ui-size\);[\s\S]*line-height: 1\.5;/);
  assert.match(styles, /\.docs-toc a \{[\s\S]*font-size: var\(--docs-ui-size\);/);
  assert.match(styles, /\.docs-sidebar-group a\[aria-current="page"\] \{[\s\S]*background:/);
  assert.match(styles, /\.docs-hero h1 \{[\s\S]*font-weight: 650;[\s\S]*letter-spacing: -0\.035em;/);
  assert.match(styles, /\.docs-site:lang\(zh-CN\) \.docs-hero h1 \{[\s\S]*font-weight: 600;[\s\S]*letter-spacing: -0\.01em;/);
  assert.match(page, /className="docs-path-grid"/);
  assert.match(styles, /\.docs-path-grid \{[\s\S]*grid-template-columns: repeat\(3/);
  assert.match(styles, /\.docs-path-grid > a \{[\s\S]*border-right: 1px solid var\(--line\);/);
  assert.match(styles, /\.docs-card \{[\s\S]*border-radius: 0;[\s\S]*background: transparent;/);
  assert.match(styles, /\.docs-card-grid \{[\s\S]*grid-template-columns: 1fr;/);
  assert.match(page, /className="docs-category-title"[\s\S]*<h2[\s\S]*<p>\{category\.description\[locale\]\}<\/p>/);
  assert.match(styles, /\.docs-category-heading \{[\s\S]*grid-template-columns: minmax\(0, 1fr\) auto;[\s\S]*padding-inline: 2px;/);
  assert.match(styles, /\.docs-category-heading p \{[\s\S]*margin-top: 7px;[\s\S]*color: var\(--quiet\);[\s\S]*font-size: 13px;[\s\S]*font-style: italic;/);
  assert.match(styles, /\.docs-site:lang\(zh-CN\) \.docs-category-heading p \{[\s\S]*font-style: normal;[\s\S]*line-height: 1\.65;/);
  assert.match(styles, /\.docs-card h3 \{[\s\S]*font-weight: 600;/);
  assert.match(styles, /\.docs-article-section p \{[\s\S]*line-height: 1\.65;/);
  assert.match(styles, /\.docs-site:lang\(zh-CN\) \.docs-article-section p \{[\s\S]*line-height: 1\.8;/);
  assert.match(styles, /\.docs-related-grid a \{[\s\S]*border-radius: 0;/);
  assert.doesNotMatch(page, /docs-home-nav|docs-featured|docs-library-heading|browseIntro/);
  assert.doesNotMatch(page, /docs-card-icon/);
  assert.doesNotMatch(page, /docs-card-link/);
  assert.doesNotMatch(page, /<p className="docs-section-label">\{t\.browse\}<\/p>/);
});

test("legacy guide URLs permanently redirect into the docs library", async () => {
  const index = await render("/guides");
  assert.equal(index.status, 308);
  assert.equal(index.headers.get("location"), "/docs");

  const article = await render("/guides/first-plugin");
  assert.equal(article.status, 308);
  assert.equal(article.headers.get("location"), "/docs/first-plugin");
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
    /<title>DSH 插件注册表 — 精确版本、manifest 与一键安装<\/title>/,
  );
  assert.doesNotMatch(html, /property="og:url" content="https:\/\/dshpluginhub\.ai\/"/);
});

test("indexable pages send a short public cache and auth stays no-store", async () => {
  const home = await render("/");
  assert.match(
    home.headers.get("cache-control") ?? "",
    /public,\s*s-maxage=300/,
  );
  const dashboard = await render("/dashboard");
  assert.match(dashboard.headers.get("cache-control") ?? "", /no-store/);
});

test("file-reading: categories index and homepage titles exist", async () => {
  const [categoriesIndex, homePage, sitemapLib] = await Promise.all([
    readFile(new URL("../app/(default)/categories/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/(default)/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/sitemap.ts", import.meta.url), "utf8"),
  ]);
  assert.match(categoriesIndex, /CategoriesIndexPage/);
  assert.match(categoriesIndex, /listCategories/);
  assert.match(sitemapLib, /absoluteUrl\("\/categories"\)/);
  assert.match(homePage, /plugin registry — exact versions/);
});
