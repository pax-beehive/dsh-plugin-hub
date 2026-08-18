import assert from "node:assert/strict";
import test from "node:test";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "../db/schema.ts";
import { D1WaitlistStore } from "../db/waitlist-store.ts";
import { deriveAdminBearer } from "../lib/admin-auth.ts";
import { createWaitlistStatsHandler } from "../lib/waitlist-admin.ts";
import { createHealthHandler } from "../lib/waitlist-health.ts";
import { createWaitlistHandler } from "../lib/waitlist-service.ts";
import { createUnsubscribeHandler } from "../lib/waitlist-unsubscribe.ts";
import { createTestD1 } from "./helpers/sqlite-d1.ts";

test("the protected stats API aggregates migrated D1 records without exposing email addresses", async (t) => {
  const { sqlite, binding } = await createTestD1();
  t.after(() => sqlite.close());
  sqlite
    .prepare(
      `INSERT INTO waitlist_signups
       (id, email, locale, source, unsubscribe_token, followup_status,
        followup_attempts, followup_result)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      "signup-1",
      "private@example.com",
      "en",
      "utm:github",
      "unsubscribe-token",
      "sent",
      1,
      "delivered",
    );

  const adminSecret = "integration-admin-secret";
  const database = drizzle(binding, { schema });
  const handler = createWaitlistStatsHandler({
    adminSecret,
    getDatabase: () => database,
  });
  const response = await handler(
    new Request("http://localhost/api/admin/waitlist/stats", {
      headers: {
        authorization: `Bearer ${await deriveAdminBearer(adminSecret)}`,
      },
    }),
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const body = await response.text();
  assert.doesNotMatch(body, /private@example\.com/);
  assert.deepEqual(JSON.parse(body).summary, {
    total: 1,
    active: 1,
    unsubscribed: 0,
    emailDelivered: 1,
    emailQueued: 0,
    emailPending: 0,
    emailFailed: 0,
    emailFailedLast24Hours: 0,
    emailPendingOver15Minutes: 0,
  });
});

test("the unsubscribe API updates a migrated D1 record and remains idempotent", async (t) => {
  const { sqlite, binding } = await createTestD1();
  t.after(() => sqlite.close());
  sqlite
    .prepare(
      `INSERT INTO waitlist_signups
       (id, email, locale, source, unsubscribe_token)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(
      "signup-1",
      "member@example.com",
      "zh",
      "direct",
      "unsubscribe-token",
    );

  const database = drizzle(binding, { schema });
  const handler = createUnsubscribeHandler({ getDatabase: () => database });
  const request = () =>
    new Request(
      "http://localhost/api/waitlist/unsubscribe?token=unsubscribe-token",
      { method: "POST" },
    );

  const first = await handler(request());
  const second = await handler(request());

  assert.equal(first.status, 200);
  assert.deepEqual(await first.json(), { status: "done" });
  assert.equal(second.status, 200);
  assert.deepEqual(await second.json(), { status: "done" });
  assert.equal(
    typeof sqlite
      .prepare("SELECT unsubscribed_at FROM waitlist_signups WHERE id = ?")
      .get("signup-1")?.unsubscribed_at,
    "string",
  );
});

test("the waitlist API persists a verified signup and its delivery result in D1", async (t) => {
  const { sqlite, binding } = await createTestD1();
  t.after(() => sqlite.close());
  const database = drizzle(binding, { schema });
  const deferred: Promise<unknown>[] = [];
  const handler = createWaitlistHandler({
    store: new D1WaitlistStore(database),
    rateLimitSalt: "integration-rate-limit-salt",
    verifyTurnstile: async () => true,
    sendWelcomeEmail: async () => ({ delivery: "delivered" }),
    defer: (promise) => deferred.push(promise),
    sleep: async () => {},
  });

  const response = await handler(
    new Request("https://dshpluginhub.ai/api/waitlist", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://dshpluginhub.ai",
        "cf-connecting-ip": "203.0.113.10",
      },
      body: JSON.stringify({
        email: " Member@Example.com ",
        locale: "en",
        turnstileToken: "verified-token",
        utmSource: "github",
      }),
    }),
  );
  await Promise.all(deferred);
  const row = sqlite
    .prepare(
      `SELECT email, locale, source, followup_status, followup_result,
              followup_attempts
       FROM waitlist_signups`,
    )
    .get();

  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), {
    status: "created",
    emailStatus: "queued",
  });
  assert.deepEqual({ ...row }, {
    email: "member@example.com",
    locale: "en",
    source: "utm:github",
    followup_status: "sent",
    followup_result: "delivered",
    followup_attempts: 1,
  });
  assert.equal(
    sqlite
      .prepare("SELECT count(*) AS count FROM waitlist_rate_limits")
      .get()?.count,
    2,
  );
});

test("the public health API reports D1 reachability without exposing waitlist data", async (t) => {
  const { sqlite, binding } = await createTestD1();
  t.after(() => sqlite.close());
  const database = drizzle(binding, { schema });
  const healthy = createHealthHandler({ getDatabase: () => database });
  const unhealthy = createHealthHandler({
    getDatabase: () => {
      throw new Error("database unavailable");
    },
  });

  const healthyResponse = await healthy();
  const unhealthyResponse = await unhealthy();

  assert.equal(healthyResponse.status, 200);
  assert.deepEqual(await healthyResponse.json(), {
    status: "ok",
    database: "reachable",
  });
  assert.equal(unhealthyResponse.status, 503);
  assert.deepEqual(await unhealthyResponse.json(), {
    status: "degraded",
    database: "unreachable",
  });
});

test("delivery alerts use the reactivation time instead of the original signup age", async (t) => {
  const { sqlite, binding } = await createTestD1();
  t.after(() => sqlite.close());
  const database = drizzle(binding, { schema });
  const store = new D1WaitlistStore(database);
  const created = await store.subscribe({
    email: "returning@example.com",
    locale: "en",
    source: "direct",
    referrer: null,
    utmSource: null,
    utmMedium: null,
    utmCampaign: null,
    consentVersion: "2026-08-17",
    unsubscribeToken: "old-token",
    unsubscribedAt: null,
  });
  sqlite
    .prepare(
      `UPDATE waitlist_signups
       SET created_at = datetime('now', '-30 days'),
           unsubscribed_at = datetime('now', '-1 day')
       WHERE id = ?`,
    )
    .run(created.record.id);
  const reactivated = await store.subscribe({
    ...created.record,
    unsubscribeToken: "new-token",
    unsubscribedAt: null,
  });
  assert.equal(reactivated.status, "reactivated");

  const adminSecret = "integration-admin-secret";
  const handler = createWaitlistStatsHandler({
    adminSecret,
    getDatabase: () => database,
  });
  const statsRequest = async () => {
    const response = await handler(
      new Request("http://localhost/api/admin/waitlist/stats", {
        headers: {
          authorization: `Bearer ${await deriveAdminBearer(adminSecret)}`,
        },
      }),
    );
    return response.json();
  };

  const pendingStats = await statsRequest();
  assert.equal(pendingStats.summary.emailPendingOver15Minutes, 0);

  await store.updateFollowup(created.record.id, {
    status: "failed",
    attempts: 3,
    error: "provider_unavailable",
  });
  const failedStats = await statsRequest();
  assert.equal(failedStats.summary.emailFailedLast24Hours, 1);
});
