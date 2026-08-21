import assert from "node:assert/strict";
import test from "node:test";
import { formatCompactCount, isHotWeeklyDownloads } from "../lib/format-count.ts";

test("formats compact download counts", () => {
  assert.equal(formatCompactCount(0), "0");
  assert.equal(formatCompactCount(999), "999");
  assert.equal(formatCompactCount(1000), "1k");
  assert.equal(formatCompactCount(1510), "1.5k");
  assert.equal(formatCompactCount(78643), "78.6k");
  assert.equal(formatCompactCount(10000), "10k");
  assert.equal(formatCompactCount(1000000), "1M");
  assert.equal(formatCompactCount(12400000), "12M");
  assert.equal(formatCompactCount(-1), "0");
  assert.equal(formatCompactCount(Number.NaN), "0");
});

test("marks weekly downloads hot only above 10000", () => {
  assert.equal(isHotWeeklyDownloads(10000), false);
  assert.equal(isHotWeeklyDownloads(10001), true);
  assert.equal(isHotWeeklyDownloads(78643), true);
  assert.equal(isHotWeeklyDownloads(0), false);
});
