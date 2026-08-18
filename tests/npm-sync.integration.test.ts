import assert from "node:assert/strict";
import test from "node:test";
import { drizzle } from "drizzle-orm/d1";
import { D1IdentityStore } from "../db/identity-store.ts";
import { D1NpmSyncStore } from "../db/npm-sync-store.ts";
import { D1PublicationStore } from "../db/publication-store.ts";
import { D1RegistryStore } from "../db/registry-store.ts";
import * as schema from "../db/schema.ts";
import { scheduleNpmSync, syncNpmPackage } from "../lib/npm-sync.ts";
import { createTestD1 } from "./helpers/sqlite-d1.ts";

const now = Date.UTC(2026, 7, 18, 18, 0, 0);

async function createFixture() {
  const { sqlite, binding } = await createTestD1();
  const db = drizzle(binding, { schema });
  await new D1IdentityStore(db).upsertWorkosUser({
    id: "user_01",
    email: "publisher@example.com",
    name: "Publisher",
    firstName: null,
    lastName: null,
    profilePictureUrl: null,
  });
  return {
    sqlite,
    publicationStore: new D1PublicationStore(db),
    registryStore: new D1RegistryStore(db),
    syncStore: new D1NpmSyncStore(db),
  };
}

function pluginVersion(version: string, deprecated?: string) {
  return {
    name: "dsh-auto-example",
    version,
    description: `Automatic example ${version}`,
    license: "MIT",
    repository: {
      type: "git",
      url: "git+https://github.com/example/dsh-auto-example.git",
    },
    keywords: ["dsh-plugin", "example"],
    dsh: {
      bundle: { patch: "./cordis.patch.yml" },
      client: { inject: [], platform: "web" },
    },
    ...(deprecated ? { deprecated } : {}),
    dist: {
      tarball: `https://registry.npmjs.org/dsh-auto-example/-/dsh-auto-example-${version}.tgz`,
      integrity: `sha512-${version}`,
      unpackedSize: 1_000,
      fileCount: 4,
    },
  };
}

function packument(versions: Record<string, unknown>, latest: string) {
  return {
    name: "dsh-auto-example",
    "dist-tags": { latest },
    versions,
    time: {
      modified: "2026-08-18T17:30:00.000Z",
      "1.0.0": "2026-08-16T10:00:00.000Z",
      "1.1.0": "2026-08-17T10:00:00.000Z",
      "1.2.0": "2026-08-18T10:00:00.000Z",
    },
  };
}

test("automatic npm sync imports history, detects new versions, and marks withdrawn versions", async (t) => {
  const fixture = await createFixture();
  t.after(() => fixture.sqlite.close());
  let body = packument({
    "1.0.0": pluginVersion("1.0.0"),
    "1.1.0": pluginVersion("1.1.0"),
  }, "1.1.0");
  const fetcher: typeof fetch = async () => Response.json(body);

  const first = await syncNpmPackage({
    packageName: "dsh-auto-example",
    source: "manual",
    syncStore: fixture.syncStore,
    publicationStore: fixture.publicationStore,
    fetcher,
    now,
  });
  const second = await syncNpmPackage({
    packageName: "dsh-auto-example",
    source: "existing",
    syncStore: fixture.syncStore,
    publicationStore: fixture.publicationStore,
    fetcher,
    now: now + 1_000,
  });

  assert.equal(first.status, "accepted");
  assert.equal(first.versionsAdded, 2);
  assert.equal(second.status, "accepted");
  assert.equal(second.versionsAdded, 0);
  let plugin = await fixture.registryStore.findPackage("dsh-auto-example");
  assert.equal(plugin?.claimed, false);
  assert.equal(plugin?.latestVersion, "1.1.0");
  assert.deepEqual(plugin?.versions.map((version) => version.version), ["1.0.0", "1.1.0"]);
  assert.equal((await fixture.syncStore.find("dsh-auto-example"))?.status, "accepted");

  body = packument({
    "1.1.0": pluginVersion("1.1.0"),
    "1.2.0": pluginVersion("1.2.0", "Use the next major release"),
  }, "1.2.0");
  const update = await syncNpmPackage({
    packageName: "dsh-auto-example",
    source: "existing",
    syncStore: fixture.syncStore,
    publicationStore: fixture.publicationStore,
    fetcher,
    now: now + 2_000,
  });
  plugin = await fixture.registryStore.findPackage("dsh-auto-example");

  assert.equal(update.status, "accepted");
  assert.equal(update.versionsAdded, 1);
  assert.equal(plugin?.latestVersion, "1.2.0");
  assert.equal(plugin?.deprecated, true);
  assert.equal(plugin?.versions.find((version) => version.version === "1.0.0")?.yanked, true);
});

test("automatic discovery rejects keyword matches without a DSH manifest", async (t) => {
  const fixture = await createFixture();
  t.after(() => fixture.sqlite.close());
  const result = await syncNpmPackage({
    packageName: "dsh-auto-example",
    source: "search",
    syncStore: fixture.syncStore,
    publicationStore: fixture.publicationStore,
    fetcher: async () => Response.json(packument({
      "1.0.0": {
        name: "dsh-auto-example",
        version: "1.0.0",
        dist: {
          tarball: "https://registry.npmjs.org/dsh-auto-example/-/dsh-auto-example-1.0.0.tgz",
        },
      },
    }, "1.0.0")),
    now,
  });

  assert.equal(result.status, "rejected");
  assert.equal((await fixture.syncStore.find("dsh-auto-example"))?.status, "rejected");
  assert.equal(await fixture.registryStore.findPackage("dsh-auto-example"), null);
});

test("scheduled discovery deduplicates search candidates before queueing", async (t) => {
  const fixture = await createFixture();
  t.after(() => fixture.sqlite.close());
  const batches: Array<Array<{ body: unknown }>> = [];
  const result = await scheduleNpmSync({
    syncStore: fixture.syncStore,
    queue: {
      async sendBatch(messages) {
        batches.push(messages as Array<{ body: unknown }>);
      },
    },
    fetcher: async () => Response.json({
      objects: [{ package: { name: "dsh-auto-example" } }],
      total: 1,
    }),
    now,
  });

  assert.equal(result.queued, 1);
  assert.equal(batches.flat().length, 1);
  assert.deepEqual(batches[0]?.[0]?.body, {
    type: "sync-package",
    packageName: "dsh-auto-example",
    trigger: "cron",
  });
});
