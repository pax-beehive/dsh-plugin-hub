import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${pathname}`, {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
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
  assert.match(
    html,
    /<title>DeepSeek Harness Plugin Hub — 插件发现与分享社区<\/title>/i,
  );
  assert.match(html, /COMING SOON/);
  assert.match(html, /Plugin Hub/);
  assert.match(html, /非官方社区项目/);
  assert.match(html, /为 Harness 插件生态而建的社区入口/);
  assert.match(html, /DeepSeek Harness Plugin Hub 是什么？/);
  assert.match(html, /name="email"/);
  assert.match(
    html,
    /rel="canonical" href="https:\/\/dshpluginhub\.ai\/?"/,
  );
  assert.match(html, /property="og:url" content="https:\/\/dshpluginhub\.ai\/?"/);
  assert.match(html, /"@type":"WebSite"/);
  assert.match(html, /"@type":"FAQPage"/);
  assert.match(html, /rel="shortcut icon" href="\/favicon\.ico"/);
  assert.match(html, /rel="icon" href="\/favicon-64\.png"/);
  assert.doesNotMatch(html, /codex-preview|Building your site/i);
});

test("server-renders the bilingual unsubscribe confirmation page", async () => {
  const response = await render("/unsubscribe?token=test-token");
  assert.equal(response.status, 200);

  const html = await response.text();
  assert.match(html, /确认退订/);
  assert.match(html, /Unsubscribe/);
  assert.match(html, /\/api\/waitlist\/unsubscribe\?token=test-token/);
  assert.match(html, /非官方独立社区项目/);
  assert.match(html, /name="robots" content="noindex, nofollow"/);
});

test("publishes crawl and AI discovery files with the canonical origin", async () => {
  const [robots, sitemap, llms] = await Promise.all([
    readFile(new URL("../public/robots.txt", import.meta.url), "utf8"),
    readFile(new URL("../public/sitemap.xml", import.meta.url), "utf8"),
    readFile(new URL("../public/llms.txt", import.meta.url), "utf8"),
  ]);

  assert.match(robots, /User-agent: OAI-SearchBot\nAllow: \//);
  assert.match(robots, /Sitemap: https:\/\/dshpluginhub\.ai\/sitemap\.xml/);
  assert.match(sitemap, /<loc>https:\/\/dshpluginhub\.ai\/<\/loc>/);
  assert.match(llms, /^# DeepSeek Harness Plugin Hub/m);
  assert.match(llms, /independent, unofficial community project/i);
  assert.match(llms, /https:\/\/github\.com\/deepseek-ai\/deepseek-harness/);
});
