import assert from "node:assert/strict";
import test from "node:test";
import { drizzle } from "drizzle-orm/d1";
import { D1RegistryStore } from "../db/registry-store.ts";
import * as schema from "../db/schema.ts";
import {
  createPackageBySlugHandler,
  createPackageResolveHandler,
  createPackageSearchHandler,
  createProfileResolveHandler,
  createProfileSearchHandler,
} from "../lib/registry-service.ts";
import { createTestD1 } from "./helpers/sqlite-d1.ts";

async function createRegistryFixture() {
  const { sqlite, binding } = await createTestD1();
  const now = "2026-08-18T00:00:00.000Z";
  const manifest = {
    name: "dsh-conversation-exporter",
    version: "0.2.0",
    description: "Clean Markdown conversation export",
    main: "lib/index.js",
    dsh: {
      bundle: { patch: "./cordis.patch.yml" },
      client: {
        inject: ["@deepseek-ai/dsh-client-runtime"],
        platform: "web",
      },
    },
  };
  sqlite
    .prepare(
      `INSERT INTO plugins
       (id, slug, package_name, display_name, summary, description,
        repository, license, categories_json, keywords_json, screenshots_json,
        verified, deprecated, latest_version, dist_tags_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      "11111111-1111-4111-8111-111111111111",
      "dsh-conversation-exporter",
      "dsh-conversation-exporter",
      "Conversation Exporter",
      "Clean Markdown conversation export",
      "Exports the current web conversation locally.",
      "liuyuelintop/dsh-conversation-exporter",
      "MIT",
      JSON.stringify(["tools"]),
      JSON.stringify(["export", "markdown"]),
      "[]",
      0,
      0,
      "0.2.0",
      JSON.stringify({ latest: "0.2.0" }),
      now,
      now,
    );
  sqlite
    .prepare(
      `INSERT INTO plugin_versions
       (id, plugin_id, version, channel, manifest_json, source_json,
        compatibility_json, entry_ids_json, before_json, after_json,
        published_at, yanked)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      "22222222-2222-4222-8222-222222222222",
      "11111111-1111-4111-8111-111111111111",
      "0.2.0",
      "stable",
      JSON.stringify(manifest),
      JSON.stringify({
        kind: "npm",
        packageName: "dsh-conversation-exporter",
        version: "0.2.0",
        tarballUrl: "https://registry.npmjs.org/dsh-conversation-exporter/-/dsh-conversation-exporter-0.2.0.tgz",
        installSpec: "dsh-conversation-exporter@0.2.0",
      }),
      JSON.stringify({
        dsh: ">=0.1.0-rc.7",
        platforms: [],
        surfaces: ["web"],
        hmr: "refresh",
      }),
      "[]",
      "[]",
      "[]",
      now,
      0,
    );
  sqlite
    .prepare(
      `INSERT INTO profiles
       (id, slug, owner, visibility, latest_version, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      "33333333-3333-4333-8333-333333333333",
      "team-web",
      "dsh-plugin-hub",
      "public",
      "1.0.0",
      now,
      now,
    );
  sqlite
    .prepare(
      `INSERT INTO profile_versions
       (id, profile_id, version, manifest_json, published_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(
      "44444444-4444-4444-8444-444444444444",
      "33333333-3333-4333-8333-333333333333",
      "1.0.0",
      JSON.stringify({
        schemaVersion: 1,
        version: "1.0.0",
        name: "Team Web",
        description: "A team community profile",
        dsh: ">=0.1.0-rc.7",
        bundles: [{ packageName: "dsh-conversation-exporter", selector: "0.2.0" }],
        patch: [],
        publishedAt: now,
      }),
      now,
    );

  return {
    sqlite,
    store: new D1RegistryStore(drizzle(binding, { schema })),
  };
}

test("registry search returns compact, cursor-ready package metadata", async (t) => {
  const { sqlite, store } = await createRegistryFixture();
  t.after(() => sqlite.close());
  const response = await createPackageSearchHandler(store)(
    new Request("https://dshpluginhub.ai/api/v1/packages?q=markdown"),
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.match(response.headers.get("cache-control") ?? "", /stale-while-revalidate/);
  assert.equal(body.items[0].packageName, "dsh-conversation-exporter");
  assert.equal("versions" in body.items[0], false);
  assert.equal(body.nextCursor, null);
});

test("package resolution exposes immutable source and compatibility metadata", async (t) => {
  const { sqlite, store } = await createRegistryFixture();
  t.after(() => sqlite.close());
  const response = await createPackageResolveHandler(store)(
    new Request("https://dshpluginhub.ai/api/v1/packages/resolve?name=dsh-conversation-exporter"),
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.versions[0].source.installSpec, "dsh-conversation-exporter@0.2.0");
  assert.equal(body.versions[0].manifest.dsh.bundle.patch, "./cordis.patch.yml");
  assert.equal(body.versions[0].compatibility.hmr, "refresh");
});

test("package lookup by slug returns the full package record", async (t) => {
  const { sqlite, store } = await createRegistryFixture();
  t.after(() => sqlite.close());
  const response = await createPackageBySlugHandler(store)("dsh-conversation-exporter");
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.match(response.headers.get("cache-control") ?? "", /stale-while-revalidate/);
  assert.equal(body.slug, "dsh-conversation-exporter");
  assert.equal(body.packageName, "dsh-conversation-exporter");
  assert.equal(body.versions[0].source.installSpec, "dsh-conversation-exporter@0.2.0");
});

test("package lookup by slug returns a stable 404 for missing slugs", async (t) => {
  const { sqlite, store } = await createRegistryFixture();
  t.after(() => sqlite.close());
  const response = await createPackageBySlugHandler(store)("missing");

  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: "package_not_found" });
});

test("profile resolution preserves the published bundle order", async (t) => {
  const { sqlite, store } = await createRegistryFixture();
  t.after(() => sqlite.close());
  const response = await createProfileResolveHandler(store)("team-web");
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.latestVersion, "1.0.0");
  assert.deepEqual(
    body.versions[0].bundles.map((bundle: { packageName: string }) => bundle.packageName),
    ["dsh-conversation-exporter"],
  );
});

test("profile search returns latest-version catalog metadata and searches its manifest", async (t) => {
  const { sqlite, store } = await createRegistryFixture();
  t.after(() => sqlite.close());
  const response = await createProfileSearchHandler(store)(
    new Request("https://dshpluginhub.ai/api/v1/profiles?q=team"),
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.match(response.headers.get("cache-control") ?? "", /stale-while-revalidate/);
  assert.deepEqual(body.items, [
    {
      id: "33333333-3333-4333-8333-333333333333",
      slug: "team-web",
      owner: "dsh-plugin-hub",
      claimed: false,
      latestVersion: "1.0.0",
      name: "Team Web",
      description: "A team community profile",
      bundleCount: 1,
      updatedAt: "2026-08-18T00:00:00.000Z",
    },
  ]);
});

test("profile search rejects invalid limits", async (t) => {
  const { sqlite, store } = await createRegistryFixture();
  t.after(() => sqlite.close());
  const response = await createProfileSearchHandler(store)(
    new Request("https://dshpluginhub.ai/api/v1/profiles?limit=0"),
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "invalid_limit" });
});

test("missing packages and profiles return stable 404 errors", async (t) => {
  const { sqlite, store } = await createRegistryFixture();
  t.after(() => sqlite.close());
  const packageResponse = await createPackageResolveHandler(store)(
    new Request("https://dshpluginhub.ai/api/v1/packages/resolve?name=missing"),
  );
  const profileResponse = await createProfileResolveHandler(store)("missing");

  assert.equal(packageResponse.status, 404);
  assert.equal(profileResponse.status, 404);
});
