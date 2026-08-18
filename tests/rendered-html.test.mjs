import assert from "node:assert/strict";
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
  assert.match(html, /<title>DeepSeek Harness Plugin Hub — Coming Soon<\/title>/i);
  assert.match(html, /COMING SOON/);
  assert.match(html, /Plugin Hub/);
  assert.match(html, /非官方社区项目/);
  assert.match(html, /name="email"/);
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
});
