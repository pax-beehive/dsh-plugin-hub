import assert from "node:assert/strict";
import test from "node:test";
import { drizzle } from "drizzle-orm/d1";
import { D1RegistryStore } from "../db/registry-store.ts";
import * as schema from "../db/schema.ts";
import { plugins } from "../db/schema.ts";
import { createTestD1 } from "./helpers/sqlite-d1.ts";

async function createFixture() {
  const { sqlite, binding } = await createTestD1();
  const db = drizzle(binding, { schema });
  return { sqlite, db, registryStore: new D1RegistryStore(db) };
}

function pluginRow(index: number, categories: string[]) {
  return {
    id: `7c9e6679-7425-40de-944b-e07fc1f90a${String(index).padStart(2, "0")}`,
    slug: `dsh-plugin-${index}`,
    packageName: `dsh-plugin-${index}`,
    displayName: `Plugin ${index}`,
    summary: `Plugin ${index} summary`,
    repository: `example/dsh-plugin-${index}`,
    latestVersion: "1.0.0",
    categoriesJson: JSON.stringify(categories),
  };
}

test("listCategories aggregates publisher categories by usage", async (t) => {
  const fixture = await createFixture();
  t.after(() => fixture.sqlite.close());
  await fixture.db.insert(plugins).values([
    pluginRow(1, ["vision", "web"]),
    pluginRow(2, ["vision"]),
    pluginRow(3, ["terminal"]),
  ]);

  const categories = await fixture.registryStore.listCategories();
  assert.deepEqual(categories, [
    { name: "vision", count: 2 },
    { name: "terminal", count: 1 },
    { name: "web", count: 1 },
  ]);
});

test("search paginates by slug cursor and preserves order", async (t) => {
  const fixture = await createFixture();
  t.after(() => fixture.sqlite.close());
  await fixture.db.insert(plugins).values([
    pluginRow(1, []),
    pluginRow(2, []),
    pluginRow(3, []),
  ]);

  const first = await fixture.registryStore.search({ query: "", cursor: null, limit: 2 });
  assert.deepEqual(first.items.map((plugin) => plugin.slug), [
    "dsh-plugin-1",
    "dsh-plugin-2",
  ]);
  assert.equal(first.nextCursor, "dsh-plugin-2");

  const second = await fixture.registryStore.search({
    query: "",
    cursor: first.nextCursor,
    limit: 2,
  });
  assert.deepEqual(second.items.map((plugin) => plugin.slug), ["dsh-plugin-3"]);
  assert.equal(second.nextCursor, null);
});

test("listByCategory matches exact category values only", async (t) => {
  const fixture = await createFixture();
  t.after(() => fixture.sqlite.close());
  await fixture.db.insert(plugins).values([
    pluginRow(1, ["vision", "web"]),
    pluginRow(2, ["vision-pro"]),
    pluginRow(3, ["terminal"]),
  ]);

  const vision = await fixture.registryStore.listByCategory("vision");
  assert.deepEqual(vision.map((plugin) => plugin.slug), ["dsh-plugin-1"]);
  assert.equal((await fixture.registryStore.listByCategory("missing")).length, 0);
});

test("searchPage returns totals, offsets, and sort orders", async (t) => {
  const fixture = await createFixture();
  t.after(() => fixture.sqlite.close());
  await fixture.db.insert(plugins).values([
    pluginRow(1, ["vision"]),
    pluginRow(2, ["vision"]),
    pluginRow(3, ["terminal"]),
  ]);

  const { D1GithubSourceStore } = await import("../db/github-source-store.ts");
  const sourceStore = new D1GithubSourceStore(fixture.db);
  const seenAt = "2026-08-18T18:00:00.000Z";
  await sourceStore.upsertListing({
    fullName: "example/dsh-plugin-1",
    description: "",
    stars: 50,
    language: null,
    license: null,
    topics: [],
    homepage: null,
    pushedAt: null,
    discoveryTopic: "dsh-plugin",
  }, seenAt);
  await sourceStore.upsertListing({
    fullName: "example/dsh-plugin-2",
    description: "",
    stars: 500,
    language: null,
    license: null,
    topics: [],
    homepage: null,
    pushedAt: null,
    discoveryTopic: "dsh-plugin",
  }, seenAt);

  // popular: starred repositories first by stars, unseen packages last.
  const popular = await fixture.registryStore.searchPage({
    query: "",
    sort: "popular",
    page: 1,
    limit: 10,
  });
  assert.equal(popular.total, 3);
  assert.deepEqual(popular.items.map((plugin) => plugin.slug), [
    "dsh-plugin-2",
    "dsh-plugin-1",
    "dsh-plugin-3",
  ]);

  // name: pure slug order; query narrows the total.
  const named = await fixture.registryStore.searchPage({
    query: "plugin-1",
    sort: "name",
    page: 1,
    limit: 10,
  });
  assert.equal(named.total, 1);

  // offset paging: page 2 of size 2 holds the remaining row.
  const pageTwo = await fixture.registryStore.searchPage({
    query: "",
    sort: "name",
    page: 2,
    limit: 2,
  });
  assert.equal(pageTwo.total, 3);
  assert.deepEqual(pageTwo.items.map((plugin) => plugin.slug), ["dsh-plugin-3"]);
});
