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
  assert.equal(result.total, 2);
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

test("omits total when the envelope does not include it", () => {
  const result = parseRegistrySearchResponse({
    items: [validItem],
    nextCursor: null,
  });

  assert.equal(result.total, undefined);
  assert.deepEqual(result.items.map((item) => item.slug), ["hello-dsh"]);
});

test("keeps the response envelope strict", () => {
  assert.throws(() =>
    parseRegistrySearchResponse({ items: [], nextCursor: null, unexpected: true }),
  );
});

test("keeps weeklyDownloads on valid items and defaults missing to 0", () => {
  const withField = parseRegistrySearchResponse({
    items: [{ ...validItem, weeklyDownloads: 78643 }],
    nextCursor: null,
    total: 1,
  });
  assert.equal(withField.items[0]?.weeklyDownloads, 78643);
  const withoutField = parseRegistrySearchResponse({
    items: [validItem],
    nextCursor: null,
    total: 1,
  });
  assert.equal(withoutField.items[0]?.weeklyDownloads, 0);
});

test("accepts optional securityPassed:true and still parses items without it", () => {
  const withField = parseRegistrySearchResponse({
    items: [{ ...validItem, securityPassed: true }],
    nextCursor: null,
    total: 1,
  });
  assert.equal(withField.items.length, 1);
  assert.equal(withField.items[0]?.securityPassed, true);
  const withoutField = parseRegistrySearchResponse({
    items: [validItem],
    nextCursor: null,
    total: 1,
  });
  assert.equal(withoutField.items.length, 1);
  assert.equal(withoutField.items[0]?.securityPassed, undefined);
});

test("accepts catalog dailyDownloads and dailyDownloadsDelta (PR #6 / 2e4541f)", () => {
  const result = parseRegistrySearchResponse({
    items: [{ ...validItem, dailyDownloads: 4, dailyDownloadsDelta: 1 }],
    nextCursor: null,
    total: 1,
  });
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0]?.dailyDownloads, 4);
  assert.equal(result.items[0]?.dailyDownloadsDelta, 1);
});

test("defaults missing daily download fields to 0", () => {
  const result = parseRegistrySearchResponse({
    items: [validItem],
    nextCursor: null,
    total: 1,
  });
  assert.equal(result.items[0]?.dailyDownloads, 0);
  assert.equal(result.items[0]?.dailyDownloadsDelta, 0);
});
