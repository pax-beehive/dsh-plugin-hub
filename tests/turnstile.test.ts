import assert from "node:assert/strict";
import test from "node:test";
import { verifyTurnstileToken } from "../lib/turnstile.ts";

test("Turnstile validation requires the expected action and hostname", async () => {
  const calls: Array<{ url: string; body: FormData }> = [];
  const valid = await verifyTurnstileToken(
    {
      secret: "secret",
      token: "token",
      remoteIp: "203.0.113.8",
      expectedAction: "waitlist",
      expectedHostnames: ["dshpluginhub.ai"],
    },
    async (url, init) => {
      calls.push({ url: String(url), body: init?.body as FormData });
      return Response.json({
        success: true,
        action: "waitlist",
        hostname: "dshpluginhub.ai",
      });
    },
  );

  assert.equal(valid, true);
  assert.equal(
    calls[0]?.url,
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
  );
  assert.equal(calls[0]?.body.get("secret"), "secret");
  assert.equal(calls[0]?.body.get("response"), "token");
  assert.equal(calls[0]?.body.get("remoteip"), "203.0.113.8");

  const wrongAction = await verifyTurnstileToken(
    {
      secret: "secret",
      token: "token",
      remoteIp: null,
      expectedAction: "waitlist",
      expectedHostnames: ["dshpluginhub.ai"],
    },
    async () =>
      Response.json({
        success: true,
        action: "login",
        hostname: "dshpluginhub.ai",
      }),
  );
  assert.equal(wrongAction, false);
});
