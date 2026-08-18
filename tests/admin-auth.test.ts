import assert from "node:assert/strict";
import test from "node:test";
import {
  deriveAdminBearer,
  hasValidAdminBearer,
} from "../lib/admin-auth.ts";

test("aggregate waitlist access requires the derived admin bearer", async () => {
  const secret = "dedicated-admin-secret";
  const bearer = await deriveAdminBearer(secret);

  assert.equal(await hasValidAdminBearer(null, secret), false);
  assert.equal(
    await hasValidAdminBearer("Bearer incorrect", secret),
    false,
  );
  assert.equal(
    await hasValidAdminBearer(`Bearer ${bearer}`, secret),
    true,
  );
});
