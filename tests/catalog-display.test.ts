import assert from "node:assert/strict";
import test from "node:test";
import {
  altPackageHint,
  descriptionsAreDuplicate,
  packageScopeHint,
  sortByWeeklyDownloads,
} from "../lib/catalog-display.ts";

test("hides a description that only repeats the summary", () => {
  assert.equal(descriptionsAreDuplicate("Same text", "Same text"), true);
  assert.equal(descriptionsAreDuplicate("  Same text  ", "Same text"), true);
  assert.equal(descriptionsAreDuplicate("Longer body", "Same text"), false);
  assert.equal(descriptionsAreDuplicate("", "Summary"), false);
});

test("sorts the current catalog page by weekly downloads desc", () => {
  const sorted = sortByWeeklyDownloads([
    { name: "stars-heavy", weeklyDownloads: 485 },
    { name: "official", weeklyDownloads: 633545 },
    { name: "mid", weeklyDownloads: 9799 },
  ]);
  assert.deepEqual(sorted.map((item) => item.name), ["official", "mid", "stars-heavy"]);
});

test("marks extra same-name cards with publisher or scope", () => {
  const items = [
    { displayName: "Im", packageName: "@xmanrui/dsh-im", repository: "xmanrui/dsh-im" },
    { displayName: "Im", packageName: "dsh-im", repository: "other/dsh-im" },
  ];
  assert.equal(altPackageHint(items, items[0]), null);
  assert.equal(altPackageHint(items, items[1]), "alt · other");
  assert.equal(packageScopeHint("@deepseek-ai/dsh-base"), "@deepseek-ai");
});
