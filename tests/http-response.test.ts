import assert from "node:assert/strict";
import test from "node:test";
import { mutableRedirect } from "../lib/http-response.ts";

test("mutable redirects accept SDK and adapter headers after construction", () => {
  const response = mutableRedirect("https://example.com/dashboard", 303);

  response.headers.set("cache-control", "no-store");
  response.headers.append("set-cookie", "session=test; Path=/; HttpOnly");

  assert.equal(response.status, 303);
  assert.equal(response.headers.get("location"), "https://example.com/dashboard");
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.match(response.headers.get("set-cookie") ?? "", /session=test/);
});
