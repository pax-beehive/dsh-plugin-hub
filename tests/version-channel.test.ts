import assert from "node:assert/strict";
import test from "node:test";
import {
  isPrereleaseVersion,
  partitionVersionRows,
  versionChannelLabel,
} from "../lib/version-channel.ts";

test("labels semver prerelease tokens without inventing API channels", () => {
  assert.equal(versionChannelLabel("1.17.1"), "stable");
  assert.equal(versionChannelLabel("1.16.0-beta.3"), "beta");
  assert.equal(versionChannelLabel("2.0.0-dev.1"), "dev");
  assert.equal(versionChannelLabel("1.0.0-rc.1"), "prerelease");
  assert.equal(versionChannelLabel("1.0.0-alpha.2"), "prerelease");
  assert.equal(isPrereleaseVersion("1.16.0-beta.1"), true);
  assert.equal(isPrereleaseVersion("1.16.0"), false);
});

test("collapses prerelease versions by default and keeps latest visible", () => {
  const versions = [
    { version: "1.16.0-beta.1" },
    { version: "1.16.0" },
    { version: "1.16.1" },
    { version: "1.17.0-rc.1" },
    { version: "1.17.1" },
  ].reverse();
  const { visible, hidden } = partitionVersionRows(versions, "1.17.1");
  assert.deepEqual(visible.map((row) => row.version), ["1.17.1", "1.16.1", "1.16.0"]);
  assert.deepEqual(hidden.map((row) => row.version), ["1.17.0-rc.1", "1.16.0-beta.1"]);
});

test("keeps a prerelease latest visible", () => {
  const versions = [{ version: "1.0.0" }, { version: "1.1.0-beta.1" }].reverse();
  const { visible, hidden } = partitionVersionRows(versions, "1.1.0-beta.1");
  assert.deepEqual(visible.map((row) => row.version), ["1.1.0-beta.1", "1.0.0"]);
  assert.deepEqual(hidden, []);
});
