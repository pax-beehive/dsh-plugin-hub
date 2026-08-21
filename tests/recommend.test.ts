import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_RECOMMEND_QUERY_CODE_POINTS,
  clampRecommendQuery,
  mapRecommendError,
  parseRecommendItems,
  prepareRecommendQuery,
  type RecommendErrorCopy,
} from "../lib/recommend.ts";

const copy: RecommendErrorCopy = {
  required: "required",
  tooLarge: "too-large",
  rateLimited: "rate-limited",
  llmBusy: "llm-busy",
  llmUnavailable: "llm-unavailable",
  storageUnavailable: "storage-unavailable",
  network: "network",
  abort: "abort",
  failed: "failed",
};

test("clamps recommend queries to 500 Unicode code points, not bytes", () => {
  assert.equal(clampRecommendQuery("  weather  "), "weather");
  assert.equal(clampRecommendQuery("a".repeat(500)).length, 500);
  assert.equal(clampRecommendQuery("a".repeat(501)), "a".repeat(500));

  const emoji = "😀".repeat(501);
  const clamped = clampRecommendQuery(emoji);
  assert.equal([...clamped].length, MAX_RECOMMEND_QUERY_CODE_POINTS);
  assert.equal(clamped, "😀".repeat(500));

  const mixed = `${"你".repeat(400)}${"🌐".repeat(200)}`;
  assert.equal([...clampRecommendQuery(mixed)].length, 500);
});

test("rejects empty queries after trim and does not treat them as sendable", () => {
  assert.deepEqual(prepareRecommendQuery(""), { ok: false, reason: "empty" });
  assert.deepEqual(prepareRecommendQuery("   \n\t  "), { ok: false, reason: "empty" });
  assert.deepEqual(prepareRecommendQuery("  查天气  "), {
    ok: true,
    query: "查天气",
  });
});

test("maps recommend API error codes to friendly copy", () => {
  assert.equal(
    mapRecommendError({ error: "query_required", status: 400 }, copy),
    "required",
  );
  assert.equal(
    mapRecommendError({ error: "query_too_large", status: 400 }, copy),
    "too-large",
  );
  assert.equal(
    mapRecommendError(
      { error: "rate_limited", status: 429, retryAfter: "30" },
      copy,
    ),
    "rate-limited",
  );
  assert.equal(
    mapRecommendError({ error: "llm_busy", status: 429 }, copy),
    "llm-busy",
  );
  assert.equal(
    mapRecommendError({ error: "llm_unavailable", status: 502 }, copy),
    "llm-unavailable",
  );
  assert.equal(
    mapRecommendError({ error: "storage_unavailable", status: 503 }, copy),
    "storage-unavailable",
  );
  assert.equal(mapRecommendError({ status: 503 }, copy), "llm-unavailable");
  assert.equal(mapRecommendError({ kind: "network" }, copy), "network");
  assert.equal(mapRecommendError({ kind: "abort" }, copy), "abort");
  assert.equal(mapRecommendError({ status: 500, error: "nope" }, copy), "failed");
});

test("parses recommend items defensively and skips incomplete cards", () => {
  const items = parseRecommendItems({
    items: [
      { slug: "weather", displayName: "Weather", reason: "Looks up forecasts." },
      { slug: "missing-name" },
      { displayName: "No slug" },
      null,
      {
        id: "id-1",
        slug: "diff",
        displayName: "Diff",
        packageName: "@demo/diff",
        latestVersion: "1.0.0",
        summary: "Format diffs",
        verified: true,
        claimed: false,
        categories: ["tools", 1],
        github: { stars: 12, pushedAt: "2026-08-01T00:00:00.000Z" },
        weeklyDownloads: 1234,
        securityPassed: true,
        updatedAt: "2026-08-01T00:00:00.000Z",
        license: "MIT",
        reason: "x".repeat(200),
      },
    ],
  });

  assert.equal(items.length, 2);
  assert.equal(items[0]?.slug, "weather");
  assert.equal(items[0]?.reason, "Looks up forecasts.");
  assert.equal(items[1]?.packageName, "@demo/diff");
  assert.deepEqual(items[1]?.categories, ["tools"]);
  assert.equal(items[1]?.reason?.length, 160);
  assert.equal(items[0]?.weeklyDownloads, undefined);
  assert.equal(items[1]?.github?.stars, 12);
  assert.equal(items[1]?.weeklyDownloads, 1234);
  assert.equal(items[0]?.securityPassed, undefined);
  assert.equal(items[1]?.securityPassed, true);
});
