import assert from "node:assert/strict";
import test from "node:test";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "../db/schema.ts";
import { D1WaitlistStore } from "../db/waitlist-store.ts";
import { createTestD1 } from "./helpers/sqlite-d1.ts";

async function createTestStore() {
  const { sqlite, binding } = await createTestD1();
  const database = drizzle(binding, { schema });
  return { sqlite, store: new D1WaitlistStore(database) };
}

const signup = {
  email: "member@example.com",
  locale: "en" as const,
  source: "direct",
  referrer: null,
  utmSource: null,
  utmMedium: null,
  utmCampaign: null,
  consentVersion: "2026-08-17",
  unsubscribeToken: "unsubscribe-token",
  unsubscribedAt: null,
};

test("committed migrations support creating and deduplicating a waitlist signup", async (t) => {
  const { sqlite, store } = await createTestStore();
  t.after(() => sqlite.close());

  const created = await store.subscribe(signup);
  const duplicate = await store.subscribe({
    ...signup,
    unsubscribeToken: "unused-token",
  });

  assert.equal(created.status, "created");
  assert.equal(duplicate.status, "already_subscribed");
  assert.equal(duplicate.record.id, created.record.id);
  assert.equal(
    sqlite.prepare("SELECT count(*) AS count FROM waitlist_signups").get()?.count,
    1,
  );
});

test("an unsubscribed D1 record can be reactivated with fresh consent and delivery state", async (t) => {
  const { sqlite, store } = await createTestStore();
  t.after(() => sqlite.close());

  const created = await store.subscribe(signup);
  sqlite
    .prepare(
      `UPDATE waitlist_signups
       SET unsubscribed_at = CURRENT_TIMESTAMP,
           followup_status = 'failed',
           followup_attempts = 3,
           followup_last_error = 'temporary_failure'
       WHERE id = ?`,
    )
    .run(created.record.id);

  const reactivated = await store.subscribe({
    ...signup,
    locale: "zh",
    source: "utm:github",
    unsubscribeToken: "replacement-token",
  });
  const row = sqlite
    .prepare(
      `SELECT locale, source, unsubscribe_token, unsubscribed_at,
              resubscribed_at, followup_status, followup_attempts,
              followup_last_error
       FROM waitlist_signups WHERE id = ?`,
    )
    .get(created.record.id);

  assert.equal(reactivated.status, "reactivated");
  assert.deepEqual({ ...row }, {
    locale: "zh",
    source: "utm:github",
    unsubscribe_token: "replacement-token",
    unsubscribed_at: null,
    resubscribed_at: row?.resubscribed_at,
    followup_status: "pending",
    followup_attempts: 0,
    followup_last_error: null,
  });
  assert.equal(typeof row?.resubscribed_at, "string");
});

test("D1 rate limiting atomically allows eight attempts and rejects the ninth", async (t) => {
  const { sqlite, store } = await createTestStore();
  t.after(() => sqlite.close());

  const decisions = [];
  for (let attempt = 0; attempt < 9; attempt += 1) {
    decisions.push(await store.consumeRateLimit("hashed-visitor-key"));
  }

  assert.deepEqual(
    decisions.map((decision) => decision.allowed),
    [true, true, true, true, true, true, true, true, false],
  );
  assert.ok(decisions[8].retryAfterSeconds > 0);
  assert.equal(
    sqlite
      .prepare("SELECT attempts FROM waitlist_rate_limits")
      .get()?.attempts,
    9,
  );
});
