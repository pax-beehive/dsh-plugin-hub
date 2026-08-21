import assert from "node:assert/strict";
import test from "node:test";
import { parseRegistrySearchResponse } from "../lib/registry-search-response.ts";

const validItem = {
  id: "11111111-1111-4111-8111-111111111111",
  slug: "hello-dsh",
  packageName: "dsh-hello",
  displayName: "Hello",
  summary: "A hello plugin",
  repository: "acme/dsh-hello",
  latestVersion: "1.0.0",
  createdAt: "2026-08-20T00:00:00.000Z",
  updatedAt: "2026-08-20T00:00:00.000Z",
};

test("quarantines malformed search items without rejecting the page", () => {
  const result = parseRegistrySearchResponse({
    items: [validItem, { ...validItem, slug: "bad-summary", summary: "x".repeat(301) }],
    nextCursor: null,
    total: 2,
  });

  assert.deepEqual(result.items.map((item) => item.slug), ["hello-dsh"]);
  assert.equal(result.total, undefined);
  assert.equal(result.nextCursor, null);
});

test("preserves totals when every search item is valid", () => {
  const result = parseRegistrySearchResponse({
    items: [{ ...validItem, weeklyDownloads: 42 }],
    nextCursor: null,
    total: 1,
  });

  assert.equal(result.total, 1);
  assert.equal(result.items[0]?.weeklyDownloads, 42);
});

test("keeps the response envelope strict", () => {
  assert.throws(() =>
    parseRegistrySearchResponse({ items: [], nextCursor: null, unexpected: true }),
  );
});
