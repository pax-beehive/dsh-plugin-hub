import assert from "node:assert/strict";
import test from "node:test";
import { drizzle } from "drizzle-orm/d1";
import { D1NpmSyncStore } from "../db/npm-sync-store.ts";
import * as schema from "../db/schema.ts";
import { createTestD1 } from "./helpers/sqlite-d1.ts";

const now = Date.UTC(2026, 7, 18, 18, 0, 0);

async function createFixture() {
  const { sqlite, binding } = await createTestD1();
  const db = drizzle(binding, { schema });
  return { sqlite, syncStore: new D1NpmSyncStore(db) };
}

test("status summary groups candidates by pipeline state", async (t) => {
  const fixture = await createFixture();
  t.after(() => fixture.sqlite.close());
  await fixture.syncStore.recordCandidate("dsh-a", "search", now);
  await fixture.syncStore.recordCandidate("dsh-b", "search", now);
  await fixture.syncStore.recordCandidate("dsh-c", "manual", now);
  await fixture.syncStore.markAccepted({
    packageName: "dsh-a",
    packageKind: "plugin",
    now,
  });
  await fixture.syncStore.markRejected("dsh-b", "not_a_dsh_bundle_or_profile", now);

  const summary = await fixture.syncStore.statusSummary();
  const byStatus = Object.fromEntries(
    summary.map((entry) => [entry.status, entry.count]),
  );
  assert.deepEqual(byStatus, { accepted: 1, rejected: 1, pending: 1 });
});

test("recently synced lists latest outcomes with errors, newest first", async (t) => {
  const fixture = await createFixture();
  t.after(() => fixture.sqlite.close());
  await fixture.syncStore.recordCandidate("dsh-a", "search", now);
  await fixture.syncStore.recordCandidate("dsh-b", "search", now);
  await fixture.syncStore.markAccepted({
    packageName: "dsh-a",
    packageKind: "plugin",
    now: now - 60_000,
  });
  await fixture.syncStore.markRejected("dsh-b", "invalid_npm_manifest", now);

  const recent = await fixture.syncStore.recentlySynced();
  assert.deepEqual(recent.map((row) => row.packageName), ["dsh-b", "dsh-a"]);
  assert.equal(recent[0]?.lastError, "invalid_npm_manifest");
  assert.equal(recent[1]?.packageKind, "plugin");
});
