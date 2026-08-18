import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  dshPackageManifestSchema,
  hubListingSchema,
} from "../packages/schemas/src/index.ts";

const exampleDirectory = new URL("../examples/example-hello/", import.meta.url);

test("the npm-first example is a self-contained DSH bundle", () => {
  const packageJson = JSON.parse(
    readFileSync(new URL("package.json", exampleDirectory), "utf8"),
  ) as unknown;
  const manifest = dshPackageManifestSchema.parse(packageJson);
  const listing = hubListingSchema.parse(manifest.dsh.hub);
  const patchUrl = new URL(manifest.dsh.bundle.patch, exampleDirectory);
  const patch = readFileSync(fileURLToPath(patchUrl), "utf8");

  assert.equal(manifest.name, "@dsh-plugin-hub/example-hello");
  assert.equal(manifest.version, "0.1.0");
  assert.equal(listing.channel, "stable");
  assert.equal(listing.compatibility?.hmr, "config");
  assert.deepEqual(listing.entryIds, ["hello-dsh"]);
  assert.match(patch, /^\s*- insert:/m);

  for (const entryId of listing.entryIds) {
    assert.match(patch, new RegExp(`^\\s+- id: ${entryId}$`, "m"));
  }
});
