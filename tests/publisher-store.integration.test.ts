import assert from "node:assert/strict";
import test from "node:test";
import { drizzle } from "drizzle-orm/d1";
import { D1IdentityStore } from "../db/identity-store.ts";
import { D1PublicationStore } from "../db/publication-store.ts";
import { D1PublisherStore } from "../db/publisher-store.ts";
import { D1RegistryStore } from "../db/registry-store.ts";
import * as schema from "../db/schema.ts";
import { parseNpmVersion } from "../lib/npm-package-parser.ts";
import { createTestD1 } from "./helpers/sqlite-d1.ts";

function npmVersion(version: string, description: string) {
  return {
    name: "dsh-owned-example",
    version,
    description,
    repository: "https://github.com/example/dsh-owned-example",
    dsh: { bundle: { patch: "./cordis.patch.yml" } },
    dist: {
      tarball: `https://registry.npmjs.org/dsh-owned-example/-/dsh-owned-example-${version}.tgz`,
      integrity: `sha512-${version}`,
    },
  };
}

test("claimed listing edits survive later automatic npm version syncs", async (t) => {
  const { sqlite, binding } = await createTestD1();
  t.after(() => sqlite.close());
  const db = drizzle(binding, { schema });
  await new D1IdentityStore(db).upsertWorkosUser({
    id: "user_01",
    email: "publisher@example.com",
    name: "Publisher",
    firstName: null,
    lastName: null,
    profilePictureUrl: null,
  });
  const publicationStore = new D1PublicationStore(db);
  const first = parseNpmVersion({
    rawPackage: npmVersion("1.0.0", "Original npm description"),
    packageName: "dsh-owned-example",
    publishedAt: "2026-08-17T00:00:00.000Z",
  });
  assert.equal(first.kind, "plugin");
  if (first.kind !== "plugin") return;
  await publicationStore.publishPlugin("user_01", first.publication);

  const publisherStore = new D1PublisherStore(db);
  await publisherStore.updateOwnedPlugin("user_01", "dsh-owned-example", {
    displayName: "Owned Example",
    summary: "Author-maintained summary",
    description: "Author-maintained description",
    homepage: "https://example.com/plugin",
    categories: ["workflow"],
    keywords: ["owned"],
    screenshots: [{ url: "https://example.com/demo.png", alt: "Plugin demo" }],
    publisherMetadata: {
      compatibility: { dsh: ">=0.1.0-rc.7", hmr: "config" },
    },
  });

  const second = parseNpmVersion({
    rawPackage: npmVersion("1.1.0", "A newer npm description"),
    packageName: "dsh-owned-example",
    publishedAt: "2026-08-18T00:00:00.000Z",
  });
  assert.equal(second.kind, "plugin");
  if (second.kind !== "plugin") return;
  await publicationStore.syncPlugin(second.publication, {
    distTags: { latest: "1.1.0" },
    deprecated: false,
  });
  const plugin = await new D1RegistryStore(db).findPackage("dsh-owned-example");

  assert.equal(plugin?.claimed, true);
  assert.equal(plugin?.displayName, "Owned Example");
  assert.equal(plugin?.summary, "Author-maintained summary");
  assert.equal(plugin?.latestVersion, "1.1.0");
  assert.deepEqual(plugin?.publisherMetadata, {
    compatibility: { dsh: ">=0.1.0-rc.7", hmr: "config" },
  });
  assert.equal(plugin?.versions.length, 2);
});
