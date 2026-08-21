import assert from "node:assert/strict";
import test from "node:test";

process.env.WORKOS_CLIENT_ID ??= "client_cache_test";
process.env.WORKOS_API_KEY ??= "sk_test_cache";
process.env.WORKOS_COOKIE_PASSWORD ??=
  "cache-test-cookie-password-at-least-32-characters";
process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI ??= "http://localhost/callback";

class MemoryCache {
  entries = new Map();

  async match(request) {
    return this.entries.get(request.url)?.clone();
  }

  async put(request, response) {
    this.entries.set(request.url, response.clone());
  }
}

test("the Worker caches anonymous public HTML by locale", async () => {
  const memoryCache = new MemoryCache();
  Object.defineProperty(globalThis, "caches", {
    configurable: true,
    value: { default: memoryCache },
  });

  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("edge-cache-test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const pending = [];
  const context = {
    waitUntil(promise) {
      pending.push(promise);
    },
    passThroughOnException() {},
  };
  const env = {
    ASSETS: {
      fetch: async () => new Response("Not found", { status: 404 }),
    },
    WORKOS_CLIENT_ID: "client_cache_test",
    WORKOS_API_KEY: "sk_test_cache",
    WORKOS_COOKIE_PASSWORD:
      "cache-test-cookie-password-at-least-32-characters",
    NEXT_PUBLIC_WORKOS_REDIRECT_URI: "http://localhost/callback",
  };

  const fetchPage = (cookie) =>
    worker.fetch(
      new Request("http://localhost/", {
        headers: {
          accept: "text/html",
          ...(cookie ? { cookie } : {}),
        },
      }),
      env,
      context,
    );

  const firstChinese = await fetchPage();
  assert.equal(firstChinese.headers.get("x-dsh-edge-cache"), "MISS");
  await Promise.all(pending.splice(0));

  const secondChinese = await fetchPage();
  assert.equal(secondChinese.headers.get("x-dsh-edge-cache"), "HIT");
  assert.match(await secondChinese.text(), /lang="zh-CN"/);

  const firstEnglish = await fetchPage("dsh-hub-locale=en");
  assert.equal(firstEnglish.headers.get("x-dsh-edge-cache"), "MISS");
  await Promise.all(pending.splice(0));

  const secondEnglish = await fetchPage("dsh-hub-locale=en");
  assert.equal(secondEnglish.headers.get("x-dsh-edge-cache"), "HIT");
  assert.match(await secondEnglish.text(), /lang="en"/);

  const signedIn = await fetchPage("wos-session=sealed");
  assert.equal(signedIn.headers.get("x-dsh-edge-cache"), "BYPASS");
});
