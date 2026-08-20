import assert from "node:assert/strict";
import test from "node:test";
import {
  buildChatgptCapiRequest,
  hashEmailSha256,
  mapCollectEventToCapi,
  parseCollectBody,
  recordConversion,
  resolveChatgptCapiConfig,
  shouldHashEmailForMatching,
} from "../lib/collect.ts";

test("accepts known collect events and drops unknown props", () => {
  const parsed = parseCollectBody({
    event: "copy_install",
    event_id: "evt_1",
    props: { package: "@ex/hello@1.0.0", profile: "web", command: "npx ...", email: "skip@example.com" },
  });
  assert.deepEqual(parsed, {
    event: "copy_install",
    event_id: "evt_1",
    props: { package: "@ex/hello@1.0.0", profile: "web", command: "npx ..." },
  });
  assert.equal(parseCollectBody({ event: "purchase" }), null);
});

test("maps collect events to ChatGPT Ads official names", () => {
  assert.deepEqual(mapCollectEventToCapi("copy_install"), {
    type: "custom",
    custom_event_name: "copy_install",
    dataType: "custom",
  });
  assert.deepEqual(mapCollectEventToCapi("sign_in_success"), {
    type: "registration_completed",
    dataType: "customer_action",
  });
});

test("builds a CAPI payload with oppref, event id, and hashed email only", async () => {
  const emailSha256 = await hashEmailSha256("User@Example.com");
  const payload = buildChatgptCapiRequest({
    event: "copy_install",
    eventId: "evt_copy",
    attribution: { oppref: "op_1", gclid: "abc", landing_path: "/?oppref=op_1" },
    props: { package: "@ex/hello@1.0.0", profile: "web" },
    emailSha256,
    timestampMs: 1_777_000_000_000,
  });

  const event = payload.events[0] as Record<string, unknown>;
  assert.equal(payload.integration_source, "dsh_plugin_hub");
  assert.equal(event.id, "evt_copy");
  assert.equal(event.type, "custom");
  assert.equal(event.custom_event_name, "copy_install");
  assert.equal(event.oppref, "op_1");
  assert.equal(event.source_url, "https://dshpluginhub.ai/?oppref=op_1");
  assert.deepEqual((event.user as { emails_sha256: string[] }).emails_sha256, [emailSha256]);
  assert.notEqual(emailSha256, "user@example.com");
  assert.match(emailSha256, /^[a-f0-9]{64}$/);
});

test("forwards copy_install to OpenAI CAPI and swallows transport errors", async () => {
  const calls: Array<{ url: string; auth: string | null }> = [];
  await recordConversion({
    event: "copy_install",
    eventId: "evt_2",
    attribution: { oppref: "op_2" },
    chatgpt: { apiKey: "test-key", pixelId: "px_123" },
    fetchImpl: async (url, init) => {
      calls.push({
        url: String(url),
        auth: new Headers(init?.headers).get("authorization"),
      });
      throw new Error("network down");
    },
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.url, "https://bzr.openai.com/v1/events?pid=px_123");
  assert.equal(calls[0]?.auth, "Bearer test-key");
});

test("does not hash email or enable CAPI when ads env is empty", () => {
  assert.equal(resolveChatgptCapiConfig({}), null);
  assert.equal(shouldHashEmailForMatching({}), false);
  assert.ok(
    shouldHashEmailForMatching({
      CHATGPT_CAPI_API_KEY: "k",
      NEXT_PUBLIC_CHATGPT_PIXEL_ID: "px",
    }),
  );
});
