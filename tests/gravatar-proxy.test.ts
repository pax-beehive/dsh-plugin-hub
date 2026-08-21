import assert from "node:assert/strict";
import test from "node:test";
import { GET } from "../app/plugin-icons/gravatar/[hash]/route.ts";

test("the Gravatar proxy validates hashes and returns cacheable images", async () => {
  const originalFetch = globalThis.fetch;
  let fetchedUrl = "";
  globalThis.fetch = async (input) => {
    fetchedUrl = String(input);
    return new Response(new Uint8Array([1, 2, 3]), {
      headers: {
        "content-type": "image/png",
        etag: '"avatar"',
      },
    });
  };

  try {
    const response = await GET(new Request("https://dshpluginhub.ai"), {
      params: Promise.resolve({
        hash: "2a1454e724832f3b0d3b15c42b347401",
      }),
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "image/png");
    assert.match(response.headers.get("cache-control") ?? "", /s-maxage=2592000/);
    assert.equal(
      fetchedUrl,
      "https://www.gravatar.com/avatar/2a1454e724832f3b0d3b15c42b347401?s=128&d=retro",
    );

    const invalid = await GET(new Request("https://dshpluginhub.ai"), {
      params: Promise.resolve({ hash: "../../secret" }),
    });
    assert.equal(invalid.status, 404);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
