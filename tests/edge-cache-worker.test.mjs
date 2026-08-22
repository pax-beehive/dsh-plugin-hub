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

  const fetchPage = (headers = {}) =>
    worker.fetch(
      new Request("http://localhost/", {
        headers: {
          accept: "text/html",
          ...headers,
        },
      }),
      env,
      context,
    );

  const firstEnglish = await fetchPage({ "accept-language": "en-US,en;q=0.9" });
  assert.equal(firstEnglish.headers.get("x-dsh-edge-cache"), "MISS");
  await Promise.all(pending.splice(0));

  const secondEnglish = await fetchPage({ "accept-language": "en-US,en;q=0.9" });
  assert.equal(secondEnglish.headers.get("x-dsh-edge-cache"), "HIT");
  assert.match(await secondEnglish.text(), /lang="en"/);

  const firstChinese = await fetchPage({ "accept-language": "zh-CN,zh;q=0.9" });
  assert.equal(firstChinese.headers.get("x-dsh-edge-cache"), "MISS");
  await Promise.all(pending.splice(0));

  const secondChinese = await fetchPage({ "accept-language": "zh-CN,zh;q=0.9" });
  assert.equal(secondChinese.headers.get("x-dsh-edge-cache"), "HIT");
  assert.match(await secondChinese.text(), /lang="zh-CN"/);

  const cookieWins = await fetchPage({
    cookie: "dsh-hub-locale=en",
    "accept-language": "zh-CN,zh;q=0.9",
  });
  assert.equal(cookieWins.headers.get("x-dsh-edge-cache"), "HIT");
  assert.match(await cookieWins.text(), /lang="en"/);

  const signedIn = await fetchPage({ cookie: "wos-session=sealed" });
  assert.equal(signedIn.headers.get("x-dsh-edge-cache"), "BYPASS");
});

test("the Worker bypasses edge caching when the runtime denies the default cache", async () => {
  const restrictedCacheStorage = {};
  let defaultCacheReads = 0;
  Object.defineProperty(restrictedCacheStorage, "default", {
    configurable: true,
    get() {
      defaultCacheReads += 1;
      throw new Error("This Worker is not permitted to access the default cache.");
    },
  });
  Object.defineProperty(globalThis, "caches", {
    configurable: true,
    value: restrictedCacheStorage,
  });

  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("restricted-cache-test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const response = await worker.fetch(
    new Request("http://localhost/docs", {
      headers: {
        accept: "text/html",
        "accept-language": "zh-CN,zh;q=0.9",
        "x-dispatched-app": "site---test",
      },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
      WORKOS_CLIENT_ID: "client_cache_test",
      WORKOS_API_KEY: "sk_test_cache",
      WORKOS_COOKIE_PASSWORD:
        "cache-test-cookie-password-at-least-32-characters",
      NEXT_PUBLIC_WORKOS_REDIRECT_URI: "http://localhost/callback",
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );

  assert.equal(response.status, 200);
  assert.equal(defaultCacheReads, 0);
  assert.equal(response.headers.get("x-dsh-edge-cache"), "BYPASS");
  assert.match(await response.text(), /可靠地使用与构建插件/);
});
