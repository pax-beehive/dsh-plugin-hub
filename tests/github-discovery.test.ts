import assert from "node:assert/strict";
import test from "node:test";
import { drizzle } from "drizzle-orm/d1";
import { D1GithubSourceStore } from "../db/github-source-store.ts";
import * as schema from "../db/schema.ts";
import { plugins } from "../db/schema.ts";
import { discoverGitHubPlugins } from "../lib/github-discovery.ts";
import { createTestD1 } from "./helpers/sqlite-d1.ts";

const now = Date.UTC(2026, 7, 18, 18, 0, 0);

async function createFixture() {
  const { sqlite, binding } = await createTestD1();
  const db = drizzle(binding, { schema });
  return { sqlite, db, store: new D1GithubSourceStore(db) };
}

function searchPage(items: unknown[]) {
  return Response.json({ incomplete_results: false, items, total_count: items.length });
}

function repo(fullName: string, overrides: Record<string, unknown> = {}) {
  return {
    full_name: fullName,
    description: `Plugin ${fullName}`,
    stargazers_count: 42,
    language: "TypeScript",
    license: { spdx_id: "MIT" },
    topics: ["dsh-plugin"],
    homepage: null,
    pushed_at: "2026-08-18T10:00:00Z",
    private: false,
    fork: false,
    archived: false,
    ...overrides,
  };
}

test("github discovery upserts topic repositories and skips forks and archived repos", async (t) => {
  const fixture = await createFixture();
  t.after(() => fixture.sqlite.close());
  const result = await discoverGitHubPlugins({
    store: fixture.store,
    now,
    topics: ["dsh-plugin"],
    fetcher: async () =>
      searchPage([
        repo("example/dsh-alpha"),
        repo("example/dsh-fork", { fork: true }),
        repo("example/dsh-archived", { archived: true }),
        repo("example/dsh-private", { private: true }),
      ]),
  });

  assert.equal(result.discovered, 1);
  assert.equal(result.rateLimited, false);
  const listing = await fixture.store.find("example/dsh-alpha");
  assert.equal(listing?.stars, 42);
  assert.equal(listing?.license, "MIT");
  assert.deepEqual(listing?.topics, ["dsh-plugin"]);
  assert.equal(listing?.linkedPackageName, null);
  assert.equal(await fixture.store.find("example/dsh-fork"), null);
  assert.equal(await fixture.store.find("example/dsh-archived"), null);
  assert.equal(await fixture.store.find("example/dsh-private"), null);
});

test("github discovery refreshes signal fields but keeps the first-seen timestamp", async (t) => {
  const fixture = await createFixture();
  t.after(() => fixture.sqlite.close());
  const fetcher = async () => searchPage([repo("example/dsh-alpha")]);
  await discoverGitHubPlugins({
    store: fixture.store,
    now: Date.UTC(2026, 7, 1, 0, 0, 0),
    topics: ["dsh-plugin"],
    fetcher,
  });
  await discoverGitHubPlugins({
    store: fixture.store,
    now,
    topics: ["dsh-plugin"],
    fetcher: async () => searchPage([repo("example/dsh-alpha", { stargazers_count: 99 })]),
  });

  const listing = await fixture.store.find("example/dsh-alpha");
  assert.equal(listing?.stars, 99);
  assert.equal(listing?.firstSeenAt, "2026-08-01T00:00:00.000Z");
  assert.equal(listing?.lastSeenAt, "2026-08-18T18:00:00.000Z");
});

test("github discovery paginates with a persisted cursor and resumes after the cycle completes", async (t) => {
  const fixture = await createFixture();
  t.after(() => fixture.sqlite.close());
  const fullPage = Array.from({ length: 100 }, (_, index) =>
    repo(`example/dsh-${String(index).padStart(3, "0")}`));
  const requestedPages: number[] = [];
  const fetcher = async (url: string | URL | Request) => {
    const page = Number(new URL(String(url)).searchParams.get("page"));
    requestedPages.push(page);
    return searchPage(page === 1 ? fullPage : [repo("example/dsh-last")]);
  };

  // First run is capped to one page; the cursor must point at page 2.
  const first = await discoverGitHubPlugins({
    store: fixture.store,
    now,
    topics: ["dsh-plugin"],
    maxPagesPerTopic: 1,
    fetcher,
  });
  assert.equal(first.discovered, 100);
  assert.equal(await fixture.store.getCursor("github:topic:dsh-plugin"), 2);

  // Second run resumes at page 2, sees a partial page, and resets the cursor.
  const second = await discoverGitHubPlugins({
    store: fixture.store,
    now,
    topics: ["dsh-plugin"],
    maxPagesPerTopic: 3,
    fetcher,
  });
  assert.equal(second.discovered, 1);
  assert.equal(await fixture.store.getCursor("github:topic:dsh-plugin"), 0);
  assert.deepEqual(requestedPages, [1, 2]);
});

test("github discovery pauses on rate limiting and keeps the cursor", async (t) => {
  const fixture = await createFixture();
  t.after(() => fixture.sqlite.close());
  const result = await discoverGitHubPlugins({
    store: fixture.store,
    now,
    topics: ["dsh-plugin"],
    fetcher: async () => new Response("rate limited", { status: 403 }),
  });

  assert.equal(result.discovered, 0);
  assert.equal(result.rateLimited, true);
  assert.equal(await fixture.store.getCursor("github:topic:dsh-plugin"), 0);
});

test("a source-only listing links to its npm package once the package is accepted", async (t) => {
  const fixture = await createFixture();
  t.after(() => fixture.sqlite.close());
  await discoverGitHubPlugins({
    store: fixture.store,
    now,
    topics: ["dsh-plugin"],
    fetcher: async () => searchPage([repo("example/dsh-alpha")]),
  });
  // Public view shows the unlinked repository.
  assert.equal((await fixture.store.listPublic({})).length, 1);

  // The author publishes an npm package; the registry record carries the
  // same repository full name.
  await fixture.db.insert(plugins).values({
    id: "plugin_01",
    slug: "dsh-alpha",
    packageName: "dsh-alpha",
    displayName: "Alpha",
    summary: "Alpha plugin",
    repository: "example/dsh-alpha",
    latestVersion: "1.0.0",
  });

  await discoverGitHubPlugins({
    store: fixture.store,
    now,
    topics: ["dsh-plugin"],
    fetcher: async () => searchPage([repo("example/dsh-alpha")]),
  });

  const listing = await fixture.store.find("example/dsh-alpha");
  assert.equal(listing?.linkedPackageName, "dsh-alpha");
  // Linked repositories leave the source-only section to the registry card.
  assert.equal((await fixture.store.listPublic({})).length, 0);
});

test("public listing filters by query and orders by stars", async (t) => {
  const fixture = await createFixture();
  t.after(() => fixture.sqlite.close());
  await discoverGitHubPlugins({
    store: fixture.store,
    now,
    topics: ["dsh-plugin"],
    fetcher: async () =>
      searchPage([
        repo("example/dsh-alpha", { stargazers_count: 10 }),
        repo("example/dsh-beta", { stargazers_count: 200 }),
        repo("other/unrelated", { description: "Nothing about plugins" }),
      ]),
  });

  const all = await fixture.store.listPublic({});
  assert.deepEqual(all.map((listing) => listing.fullName), [
    "example/dsh-beta",
    "other/unrelated",
    "example/dsh-alpha",
  ]);
  const filtered = await fixture.store.listPublic({ query: "dsh-alpha" });
  assert.deepEqual(filtered.map((listing) => listing.fullName), ["example/dsh-alpha"]);
});

test("registry search and detail attach github signals to accepted plugins", async (t) => {
  const fixture = await createFixture();
  t.after(() => fixture.sqlite.close());
  await discoverGitHubPlugins({
    store: fixture.store,
    now,
    topics: ["dsh-plugin"],
    fetcher: async () => searchPage([repo("example/dsh-alpha", { stargazers_count: 77 })]),
  });
  await fixture.db.insert(plugins).values({
    id: "7c9e6679-7425-40de-944b-e07fc1f90ae7",
    slug: "dsh-alpha",
    packageName: "dsh-alpha",
    displayName: "Alpha",
    summary: "Alpha plugin",
    repository: "example/dsh-alpha",
    latestVersion: "1.0.0",
  });

  const { D1RegistryStore } = await import("../db/registry-store.ts");
  const registryStore = new D1RegistryStore(fixture.db);
  const search = await registryStore.search({ query: "", cursor: null, limit: 10 });
  assert.equal(search.items[0]?.github?.stars, 77);
  assert.equal(search.items[0]?.github?.pushedAt, "2026-08-18T10:00:00.000Z");
});
