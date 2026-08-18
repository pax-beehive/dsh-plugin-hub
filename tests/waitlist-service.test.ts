import assert from "node:assert/strict";
import test from "node:test";
import {
  createWaitlistHandler,
  type FollowupUpdate,
  type SubscriptionRecord,
  type WaitlistStore,
} from "../lib/waitlist-service.ts";

class MemoryStore implements WaitlistStore {
  records = new Map<string, SubscriptionRecord>();
  updates: FollowupUpdate[] = [];
  rateLimitAllowed = true;

  async consumeRateLimit() {
    return {
      allowed: this.rateLimitAllowed,
      retryAfterSeconds: this.rateLimitAllowed ? 0 : 120,
    };
  }

  async subscribe(input: Omit<SubscriptionRecord, "id">) {
    const existing = this.records.get(input.email);
    if (existing && !existing.unsubscribedAt) {
      return { status: "already_subscribed" as const, record: existing };
    }

    const record = {
      ...input,
      id: existing?.id ?? crypto.randomUUID(),
      unsubscribedAt: null,
    };
    this.records.set(input.email, record);
    return {
      status: existing ? ("reactivated" as const) : ("created" as const),
      record,
    };
  }

  async updateFollowup(_id: string, update: FollowupUpdate) {
    this.updates.push(update);
  }
}

function request(body: Record<string, unknown>) {
  return new Request("https://dshpluginhub.ai/api/waitlist", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://dshpluginhub.ai",
      "cf-connecting-ip": "203.0.113.8",
    },
    body: JSON.stringify(body),
  });
}

test("an unsubscribed visitor can subscribe again and receives a new email", async () => {
  const store = new MemoryStore();
  store.records.set("reader@example.com", {
    id: "existing-signup",
    email: "reader@example.com",
    locale: "zh",
    source: "hero",
    referrer: null,
    utmSource: null,
    utmMedium: null,
    utmCampaign: null,
    consentVersion: "2026-08-17",
    unsubscribeToken: "old-token",
    unsubscribedAt: "2026-08-16 08:00:00",
  });
  const deferred: Promise<unknown>[] = [];
  const sent: string[] = [];
  const handler = createWaitlistHandler({
    store,
    rateLimitSalt: "test-salt",
    verifyTurnstile: async () => true,
    sendWelcomeEmail: async ({ email }) => {
      sent.push(email);
      return { delivery: "delivered" };
    },
    defer: (promise) => deferred.push(promise),
    sleep: async () => {},
  });

  const response = await handler(
    request({
      email: "Reader@Example.com ",
      locale: "en",
      turnstileToken: "valid-token",
    }),
  );

  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), {
    status: "reactivated",
    emailStatus: "queued",
  });
  await Promise.all(deferred);
  assert.deepEqual(sent, ["reader@example.com"]);
  assert.notEqual(
    store.records.get("reader@example.com")?.unsubscribeToken,
    "old-token",
  );
});

test("a transient welcome-email failure is retried before being marked sent", async () => {
  const store = new MemoryStore();
  const deferred: Promise<unknown>[] = [];
  let attempts = 0;
  const handler = createWaitlistHandler({
    store,
    rateLimitSalt: "test-salt",
    verifyTurnstile: async () => true,
    sendWelcomeEmail: async () => {
      attempts += 1;
      if (attempts < 3) throw new Error("temporary_provider_error");
      return { delivery: "queued" };
    },
    defer: (promise) => deferred.push(promise),
    sleep: async () => {},
  });

  const response = await handler(
    request({ email: "retry@example.com", turnstileToken: "valid-token" }),
  );
  assert.equal(response.status, 201);
  await Promise.all(deferred);

  assert.equal(attempts, 3);
  assert.deepEqual(store.updates, [
    { status: "sent", attempts: 3, result: "queued" },
  ]);
});

test("an active subscriber is deduplicated without sending another email", async () => {
  const store = new MemoryStore();
  store.records.set("active@example.com", {
    id: "active-signup",
    email: "active@example.com",
    locale: "en",
    source: "hero",
    referrer: null,
    utmSource: null,
    utmMedium: null,
    utmCampaign: null,
    consentVersion: "2026-08-17",
    unsubscribeToken: "active-token",
    unsubscribedAt: null,
  });
  const deferred: Promise<unknown>[] = [];
  const handler = createWaitlistHandler({
    store,
    rateLimitSalt: "test-salt",
    verifyTurnstile: async () => true,
    sendWelcomeEmail: async () => {
      throw new Error("should_not_send");
    },
    defer: (promise) => deferred.push(promise),
    sleep: async () => {},
  });

  const response = await handler(
    request({ email: "active@example.com", turnstileToken: "valid-token" }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "already_subscribed" });
  assert.equal(deferred.length, 0);
});

test("failed bot verification and rate limiting stop the write path", async () => {
  const challengedStore = new MemoryStore();
  const challenged = createWaitlistHandler({
    store: challengedStore,
    rateLimitSalt: "test-salt",
    verifyTurnstile: async () => false,
    sendWelcomeEmail: async () => ({ delivery: "delivered" }),
    defer: () => {},
    sleep: async () => {},
  });
  const challengeResponse = await challenged(
    request({ email: "bot@example.com", turnstileToken: "bad-token" }),
  );
  assert.equal(challengeResponse.status, 403);
  assert.equal(challengedStore.records.size, 0);

  const limitedStore = new MemoryStore();
  limitedStore.rateLimitAllowed = false;
  const limited = createWaitlistHandler({
    store: limitedStore,
    rateLimitSalt: "test-salt",
    verifyTurnstile: async () => true,
    sendWelcomeEmail: async () => ({ delivery: "delivered" }),
    defer: () => {},
    sleep: async () => {},
  });
  const limitedResponse = await limited(
    request({ email: "fast@example.com", turnstileToken: "valid-token" }),
  );
  assert.equal(limitedResponse.status, 429);
  assert.equal(limitedResponse.headers.get("retry-after"), "120");
  assert.equal(limitedStore.records.size, 0);
});

test("the form remains usable with D1 rate limiting when Turnstile is not configured", async () => {
  const store = new MemoryStore();
  const deferred: Promise<unknown>[] = [];
  const handler = createWaitlistHandler({
    store,
    rateLimitSalt: "test-salt",
    turnstileRequired: false,
    verifyTurnstile: async () => false,
    sendWelcomeEmail: async () => ({ delivery: "delivered" }),
    defer: (promise) => deferred.push(promise),
    sleep: async () => {},
  });

  const response = await handler(request({ email: "human@example.com" }));
  assert.equal(response.status, 201);
  await Promise.all(deferred);
  assert.equal(store.records.has("human@example.com"), true);
});
