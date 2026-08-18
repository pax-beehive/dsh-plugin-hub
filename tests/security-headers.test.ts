import assert from "node:assert/strict";
import test from "node:test";
import { withSecurityHeaders } from "../lib/security-headers.ts";

test("security headers prevent framing and allow the Turnstile runtime", async () => {
  const response = withSecurityHeaders(
    new Response("ok", { headers: { "content-type": "text/plain" } }),
  );

  assert.equal(response.headers.get("x-frame-options"), "DENY");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.match(
    response.headers.get("content-security-policy") ?? "",
    /frame-src https:\/\/challenges\.cloudflare\.com/,
  );
  assert.match(
    response.headers.get("content-security-policy") ?? "",
    /frame-ancestors 'none'/,
  );
  assert.equal(await response.text(), "ok");
});
