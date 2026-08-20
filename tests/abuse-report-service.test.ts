import assert from "node:assert/strict";
import test from "node:test";
import {
  createAbuseReportHandler,
  type AbuseReportRecord,
  type AbuseReportStore,
} from "../lib/abuse-report-service.ts";

class MemoryStore implements AbuseReportStore {
  reports: AbuseReportRecord[] = [];
  rateLimitAllowed = true;

  async consumeRateLimit() {
    return {
      allowed: this.rateLimitAllowed,
      retryAfterSeconds: this.rateLimitAllowed ? 0 : 120,
    };
  }

  async createReport(input: Omit<AbuseReportRecord, "id">) {
    const record = { ...input, id: crypto.randomUUID() };
    this.reports.push(record);
    return record;
  }
}

function request(body: Record<string, unknown>) {
  return new Request("https://dshpluginhub.ai/api/report", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://dshpluginhub.ai",
      "cf-connecting-ip": "203.0.113.8",
    },
    body: JSON.stringify(body),
  });
}

function createHandler(store: MemoryStore, turnstilePasses = true) {
  return createAbuseReportHandler({
    store,
    rateLimitSalt: "test-salt",
    verifyTurnstile: async () => turnstilePasses,
  });
}

test("accepts a valid report with all fields", async () => {
  const store = new MemoryStore();
  const handler = createHandler(store);

  const response = await handler(
    request({
      packageName: "@author/malicious-plugin",
      category: "malicious_code",
      description: "This plugin exfiltrates environment variables to a remote server.",
      reporterEmail: "reporter@example.com",
      turnstileToken: "valid-token",
    }),
  );

  assert.equal(response.status, 201);
  const body = await response.json();
  assert.equal(body.status, "received");
  assert.ok(body.reportId);

  assert.equal(store.reports.length, 1);
  assert.equal(store.reports[0].packageName, "@author/malicious-plugin");
  assert.equal(store.reports[0].category, "malicious_code");
  assert.equal(store.reports[0].reporterEmail, "reporter@example.com");
});

test("accepts a report without optional fields", async () => {
  const store = new MemoryStore();
  const handler = createHandler(store);

  const response = await handler(
    request({
      category: "spam",
      description: "This is a spam plugin with misleading description.",
      turnstileToken: "valid-token",
    }),
  );

  assert.equal(response.status, 201);
  assert.equal(store.reports.length, 1);
  assert.equal(store.reports[0].packageName, null);
  assert.equal(store.reports[0].reporterEmail, null);
});

test("rejects a report with short description", async () => {
  const store = new MemoryStore();
  const handler = createHandler(store);

  const response = await handler(
    request({
      category: "other",
      description: "short",
      turnstileToken: "valid-token",
    }),
  );

  assert.equal(response.status, 400);
  const body = await response.json();
  assert.equal(body.error, "invalid_description");
  assert.equal(store.reports.length, 0);
});

test("rejects a report with invalid category", async () => {
  const store = new MemoryStore();
  const handler = createHandler(store);

  const response = await handler(
    request({
      category: "nonexistent",
      description: "A valid description that is long enough.",
      turnstileToken: "valid-token",
    }),
  );

  assert.equal(response.status, 400);
  const body = await response.json();
  assert.equal(body.error, "invalid_category");
});

test("rejects when turnstile fails", async () => {
  const store = new MemoryStore();
  const handler = createHandler(store, false);

  const response = await handler(
    request({
      category: "security",
      description: "A valid description that is long enough.",
      turnstileToken: "invalid-token",
    }),
  );

  assert.equal(response.status, 403);
  const body = await response.json();
  assert.equal(body.error, "challenge_failed");
  assert.equal(store.reports.length, 0);
});

test("rate limits excessive submissions", async () => {
  const store = new MemoryStore();
  store.rateLimitAllowed = false;
  const handler = createHandler(store);

  const response = await handler(
    request({
      category: "other",
      description: "A valid description that is long enough.",
      turnstileToken: "valid-token",
    }),
  );

  assert.equal(response.status, 429);
  const body = await response.json();
  assert.equal(body.error, "rate_limited");
  assert.ok(response.headers.get("retry-after"));
});

test("honeypot field returns fake success", async () => {
  const store = new MemoryStore();
  const handler = createHandler(store);

  const response = await handler(
    request({
      category: "spam",
      description: "A valid description that is long enough.",
      turnstileToken: "valid-token",
      website: "https://spam-bot.example.com",
    }),
  );

  assert.equal(response.status, 201);
  const body = await response.json();
  assert.equal(body.status, "received");
  assert.equal(store.reports.length, 0);
});

test("rejects cross-origin requests", async () => {
  const store = new MemoryStore();
  const handler = createHandler(store);

  const req = new Request("https://dshpluginhub.ai/api/report", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://evil.example.com",
    },
    body: JSON.stringify({
      category: "other",
      description: "A valid description that is long enough.",
      turnstileToken: "valid-token",
    }),
  });

  const response = await handler(req);
  assert.equal(response.status, 403);
  const body = await response.json();
  assert.equal(body.error, "invalid_origin");
});

test("rejects non-json content type", async () => {
  const store = new MemoryStore();
  const handler = createHandler(store);

  const req = new Request("https://dshpluginhub.ai/api/report", {
    method: "POST",
    headers: { "content-type": "text/plain" },
    body: "not json",
  });

  const response = await handler(req);
  assert.equal(response.status, 415);
});

test("truncates overly long fields", async () => {
  const store = new MemoryStore();
  const handler = createHandler(store);

  const response = await handler(
    request({
      packageName: "x".repeat(300),
      category: "other",
      description: "A valid description that is long enough.",
      reporterEmail: "a@b.co",
      turnstileToken: "valid-token",
    }),
  );

  assert.equal(response.status, 201);
  assert.ok(store.reports[0].packageName!.length <= 200);
});
