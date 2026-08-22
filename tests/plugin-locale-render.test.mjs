import assert from "node:assert/strict";
import test from "node:test";

process.env.WORKOS_CLIENT_ID ??= "client_render_test";
process.env.WORKOS_API_KEY ??= "sk_test_render";
process.env.WORKOS_COOKIE_PASSWORD ??=
  "render-test-cookie-password-at-least-32-characters";
process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI ??= "http://localhost/callback";

const zhSummary = "用于上下文洞察和管理的 DeepSeek Harness 插件。";
const zhDescription = "提供上下文压缩、洞察提取和会话管理能力。";
const enSummary = "A DeepSeek Harness plugin for context insight and management.";
const enDescription = "Provides context compression, insight extraction, and session management.";

function pluginRecord(locale) {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    slug: "dsh-context",
    packageName: "dsh-context",
    displayName: "DSH Context",
    summary: locale === "zh" ? zhSummary : enSummary,
    description: locale === "zh" ? zhDescription : enDescription,
    repository: "pax-beehive/dsh-context",
    categories: ["memory-context"],
    latestVersion: "1.0.0",
    versions: [
      {
        version: "1.0.0",
        manifest: {
          name: "dsh-context",
          version: "1.0.0",
          dsh: { bundle: { patch: "./cordis.patch.yml" } },
        },
        source: {
          kind: "github",
          repository: "pax-beehive/dsh-context",
          ref: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          installSpec: "github:pax-beehive/dsh-context#aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        },
        compatibility: {},
        publishedAt: "2026-08-20T00:00:00.000Z",
      },
    ],
    createdAt: "2026-08-20T00:00:00.000Z",
    updatedAt: "2026-08-20T00:00:00.000Z",
  };
}

function pluginSearchEnvelope(locale) {
  const summary = pluginRecord(locale);
  delete summary.versions;
  return { items: [summary], nextCursor: null, total: 1 };
}

function dataOrigin(payload) {
  return `data:application/json,${encodeURIComponent(JSON.stringify(payload))}#`;
}

async function render(pathname, locale, apiPayload) {
  const originalOrigin = process.env.HUB_API_ORIGIN;
  const originalInfo = console.info;
  process.env.HUB_API_ORIGIN = dataOrigin(apiPayload);
  console.info = () => {};
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("locale-test", `${process.pid}-${Date.now()}-${Math.random()}`);
  const { default: worker } = await import(workerUrl.href);
  try {
    return await worker.fetch(
      new Request(`http://localhost${pathname}`, {
        headers: {
          accept: "text/html",
          cookie: `dsh-hub-locale=${locale}`,
        },
      }),
      {
        ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
        HUB_API_ORIGIN: dataOrigin(apiPayload),
        WORKOS_CLIENT_ID: "client_render_test",
        WORKOS_API_KEY: "sk_test_render",
        WORKOS_COOKIE_PASSWORD: "render-test-cookie-password-at-least-32-characters",
        NEXT_PUBLIC_WORKOS_REDIRECT_URI: "http://localhost/callback",
      },
      { waitUntil() {}, passThroughOnException() {} },
    );
  } finally {
    console.info = originalInfo;
    if (originalOrigin === undefined) delete process.env.HUB_API_ORIGIN;
    else process.env.HUB_API_ORIGIN = originalOrigin;
  }
}

test("Chinese plugin detail, metadata, and JSON-LD use translated API content", async () => {
  const response = await render("/plugins/dsh-context", "zh", pluginRecord("zh"));
  const html = await response.text();
  assert.equal(response.status, 200, html);
  assert.match(html, new RegExp(zhSummary));
  assert.match(html, new RegExp(zhDescription));
  assert.match(html, new RegExp(`<meta name="description" content="${zhSummary}`));
  assert.match(html, new RegExp(`"description":"${zhSummary}"`));
});

test("English plugin detail keeps the original API content", async () => {
  const response = await render("/plugins/dsh-context", "en", pluginRecord("en"));
  const html = await response.text();
  assert.equal(response.status, 200, html);
  assert.match(html, new RegExp(enSummary));
  assert.match(html, new RegExp(enDescription));
  assert.match(html, new RegExp(`<meta name="description" content="${enSummary}`));
  assert.doesNotMatch(html, new RegExp(zhSummary));
});

test("Chinese plugin catalog renders translated summaries", async () => {
  const response = await render("/plugins", "zh", pluginSearchEnvelope("zh"));
  const html = await response.text();
  assert.equal(response.status, 200, html);
  assert.match(html, new RegExp(zhSummary));
  assert.doesNotMatch(html, new RegExp(enSummary));
});

test("Chinese category page renders translated plugin summaries", async () => {
  const response = await render(
    "/categories/memory-context",
    "zh",
    pluginSearchEnvelope("zh"),
  );
  const html = await response.text();
  assert.equal(response.status, 200, html);
  assert.match(html, new RegExp(zhSummary));
  assert.doesNotMatch(html, new RegExp(enSummary));
});
