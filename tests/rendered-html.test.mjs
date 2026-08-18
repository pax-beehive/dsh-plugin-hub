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
  assert.match(html, /^<!DOCTYPE html><html lang="zh-CN">/i);
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
  assert.match(html, /href="\/privacy"/);
  assert.match(
    html,
    /rel="canonical" href="https:\/\/dshpluginhub\.ai\/?"/,
  );
  assert.match(html, /property="og:url" content="https:\/\/dshpluginhub\.ai\/?"/);
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

test("server-renders an independently indexable English landing page", async () => {
  const response = await render("/en");
  assert.equal(response.status, 200);

  const html = await response.text();
  assert.match(
    html,
    /<title>DeepSeek Harness Plugin Hub — Discover and share plugins<\/title>/i,
  );
  assert.match(html, /^<!DOCTYPE html><html lang="en">/i);
  assert.match(html, /An open community hub to discover, share, and install Harness plugins/);
  assert.match(html, /What is DeepSeek Harness Plugin Hub\?/);
  assert.match(html, /rel="canonical" href="https:\/\/dshpluginhub\.ai\/en"/);
  assert.match(
    html,
    /rel="alternate" hrefLang="en" href="https:\/\/dshpluginhub\.ai\/en"/i,
  );
  assert.match(
    html,
    /rel="alternate" hrefLang="zh-CN" href="https:\/\/dshpluginhub\.ai\/?"/i,
  );
  assert.match(html, /href="\/"[^>]*>中文<\/a>/i);
  assert.match(html, /href="\/en"[^>]*>EN<\/a>/i);
  assert.match(html, /"@id":"https:\/\/dshpluginhub\.ai\/en#webpage"/);
  assert.doesNotMatch(
    html,
    /"@id":"https:\/\/dshpluginhub\.ai\/#webpage"/,
  );
});

test("server-renders the bilingual privacy notice", async () => {
  const response = await render("/privacy");
  assert.equal(response.status, 200);

  const html = await response.text();
  assert.match(html, /你的邮箱如何被使用/);
  assert.match(html, /What we collect/);
  assert.match(html, /hello@dshpluginhub\.ai/);
  assert.match(html, /rel="canonical" href="https:\/\/dshpluginhub\.ai\/privacy"/);
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
  const [robots, sitemap, llms, markdownHome, llmsFull, llmSingular] =
    await Promise.all([
      readFile(new URL("../public/robots.txt", import.meta.url), "utf8"),
      readFile(new URL("../public/sitemap.xml", import.meta.url), "utf8"),
      readFile(new URL("../public/llms.txt", import.meta.url), "utf8"),
      readFile(new URL("../public/index.md", import.meta.url), "utf8"),
      readFile(new URL("../public/llms-full.txt", import.meta.url), "utf8"),
      readFile(new URL("../public/llm.txt", import.meta.url), "utf8"),
    ]);

  assert.match(robots, /User-agent: OAI-SearchBot\nAllow: \//);
  assert.match(robots, /User-agent: Claude-SearchBot\nAllow: \//);
  assert.match(robots, /User-agent: PerplexityBot\nAllow: \//);
  assert.match(robots, /Sitemap: https:\/\/dshpluginhub\.ai\/sitemap\.xml/);
  assert.match(sitemap, /<loc>https:\/\/dshpluginhub\.ai\/<\/loc>/);
  assert.match(sitemap, /<loc>https:\/\/dshpluginhub\.ai\/en<\/loc>/);
  assert.match(sitemap, /<loc>https:\/\/dshpluginhub\.ai\/privacy<\/loc>/);
  assert.match(llms, /^# DeepSeek Harness Plugin Hub/m);
  assert.match(llms, /independent, unofficial community project/i);
  assert.match(llms, /https:\/\/dshpluginhub\.ai\/index\.md/);
  assert.match(llms, /https:\/\/dshpluginhub\.ai\/en/);
  assert.match(llms, /https:\/\/github\.com\/deepseek-ai\/deepseek-harness/);
  assert.match(markdownHome, /## Current status/);
  assert.match(markdownHome, /## Planned first release/);
  assert.match(markdownHome, /English page: https:\/\/dshpluginhub\.ai\/en/);
  assert.match(markdownHome, /not affiliated with, authorized by, or endorsed/i);
  assert.match(llmsFull, /## Frequently asked questions/);
  assert.match(llmsFull, /Do not claim that plugins can already be browsed/);
  assert.match(llmSingular, /canonical llms\.txt/i);
  assert.match(llmSingular, /https:\/\/dshpluginhub\.ai\/llms\.txt/);
});

test("serves the vinext hydration manifest directly from Worker assets", async () => {
  const config = JSON.parse(
    await readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8"),
  );

  assert.equal(
    config.assets.run_worker_first,
    undefined,
    "asset-first routing is required for vinext-client-entry-manifest.json",
  );
});
