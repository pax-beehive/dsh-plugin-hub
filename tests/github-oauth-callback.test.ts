import assert from "node:assert/strict";
import test from "node:test";
import { createGitHubInstallState } from "../lib/github-install-state.ts";
import { planGitHubOAuthCallback } from "../lib/github-oauth-callback.ts";

const stateSecret = "test-secret-with-at-least-thirty-two-characters";
const redirectUri = "https://staging.dshpluginhub.ai/integrations/github/oauth/callback";
const now = Date.UTC(2026, 7, 18, 12, 0, 0);

test("an existing-installation update continues through explicit GitHub OAuth", async () => {
  const signed = await createGitHubInstallState({
    userId: "user_01",
    secret: stateSecret,
    now,
  });

  const authorization = await planGitHubOAuthCallback({
    code: null,
    state: signed.state,
    queryInstallationId: "154560008",
    cookieNonce: signed.nonce,
    workosUserId: "user_01",
    stateSecret,
    clientId: "Iv1.test",
    redirectUri,
    now,
  });

  assert.equal(authorization?.kind, "authorize");
  if (authorization?.kind !== "authorize") return;
  const url = new URL(authorization.url);
  assert.equal(url.origin + url.pathname, "https://github.com/login/oauth/authorize");
  assert.equal(url.searchParams.get("client_id"), "Iv1.test");
  assert.equal(url.searchParams.get("redirect_uri"), redirectUri);

  const claim = await planGitHubOAuthCallback({
    code: "temporary-code",
    state: url.searchParams.get("state"),
    queryInstallationId: null,
    cookieNonce: signed.nonce,
    workosUserId: "user_01",
    stateSecret,
    clientId: "Iv1.test",
    redirectUri,
    now: now + 60_000,
  });

  assert.deepEqual(claim, { kind: "claim", installationId: 154_560_008 });
});

test("a direct install callback with code and installation_id can be claimed", async () => {
  const signed = await createGitHubInstallState({
    userId: "user_01",
    secret: stateSecret,
    now,
  });

  const claim = await planGitHubOAuthCallback({
    code: "temporary-code",
    state: signed.state,
    queryInstallationId: "154560008",
    cookieNonce: signed.nonce,
    workosUserId: "user_01",
    stateSecret,
    clientId: "Iv1.test",
    redirectUri,
    now,
  });

  assert.deepEqual(claim, { kind: "claim", installationId: 154_560_008 });
});

test("a bound installation cannot be replaced by a query parameter", async () => {
  const signed = await createGitHubInstallState({
    userId: "user_01",
    secret: stateSecret,
    now,
  });
  const authorization = await planGitHubOAuthCallback({
    code: null,
    state: signed.state,
    queryInstallationId: "154560008",
    cookieNonce: signed.nonce,
    workosUserId: "user_01",
    stateSecret,
    clientId: "Iv1.test",
    redirectUri,
    now,
  });
  assert.equal(authorization?.kind, "authorize");
  if (authorization?.kind !== "authorize") return;

  const claim = await planGitHubOAuthCallback({
    code: "temporary-code",
    state: new URL(authorization.url).searchParams.get("state"),
    queryInstallationId: "666",
    cookieNonce: signed.nonce,
    workosUserId: "user_01",
    stateSecret,
    clientId: "Iv1.test",
    redirectUri,
    now,
  });

  assert.equal(claim, null);
});
