import assert from "node:assert/strict";
import test from "node:test";
import {
  bindGitHubInstallationToState,
  createGitHubInstallState,
  verifyGitHubInstallState,
} from "../lib/github-install-state.ts";

const stateSecret = "test-secret-with-at-least-thirty-two-characters";
const now = Date.UTC(2026, 7, 18, 12, 0, 0);

test("GitHub install state binds the callback to its WorkOS user and nonce", async () => {
  const signed = await createGitHubInstallState({
    userId: "user_01",
    secret: stateSecret,
    now,
  });

  const verified = await verifyGitHubInstallState({
    state: signed.state,
    secret: stateSecret,
    expectedUserId: "user_01",
    expectedNonce: signed.nonce,
    now: now + 60_000,
  });

  assert.equal(verified?.sub, "user_01");
  assert.equal(verified?.nonce, signed.nonce);
  assert.equal(verified?.exp, Math.floor(now / 1000) + 600);
});

test("GitHub install state rejects tampering and callback substitution", async () => {
  const signed = await createGitHubInstallState({
    userId: "user_01",
    secret: stateSecret,
    now,
  });
  const checks = await Promise.all([
    verifyGitHubInstallState({
      state: nonCanonicalSignatureVariant(signed.state),
      secret: stateSecret,
      expectedUserId: "user_01",
      expectedNonce: signed.nonce,
      now,
    }),
    verifyGitHubInstallState({
      state: signed.state,
      secret: stateSecret,
      expectedUserId: "user_02",
      expectedNonce: signed.nonce,
      now,
    }),
    verifyGitHubInstallState({
      state: signed.state,
      secret: stateSecret,
      expectedUserId: "user_01",
      expectedNonce: "different-nonce",
      now,
    }),
    verifyGitHubInstallState({
      state: signed.state,
      secret: stateSecret,
      expectedUserId: "user_01",
      expectedNonce: signed.nonce,
      now: now + 600_000,
    }),
  ]);

  assert.deepEqual(checks, [null, null, null, null]);
});

function nonCanonicalSignatureVariant(state: string): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  const last = state.at(-1)!;
  const index = alphabet.indexOf(last);
  assert.equal(index % 4, 0, "SHA-256 base64url signature must end on a canonical 4-value boundary");
  return `${state.slice(0, -1)}${alphabet[index + 1]}`;
}

test("GitHub install state requires a high-entropy secret", async () => {
  await assert.rejects(
    createGitHubInstallState({ userId: "user_01", secret: "too-short" }),
    /github_oauth_state_secret_too_short/,
  );
});

test("GitHub install state securely carries an installation across a second OAuth callback", async () => {
  const signed = await createGitHubInstallState({
    userId: "user_01",
    secret: stateSecret,
    now,
  });

  const rebound = await bindGitHubInstallationToState({
    state: signed.state,
    secret: stateSecret,
    expectedUserId: "user_01",
    expectedNonce: signed.nonce,
    installationId: 154_560_008,
    now,
  });
  assert.ok(rebound);

  const verified = await verifyGitHubInstallState({
    state: rebound,
    secret: stateSecret,
    expectedUserId: "user_01",
    expectedNonce: signed.nonce,
    now: now + 60_000,
  });

  assert.equal(verified?.installationId, 154_560_008);
  assert.equal(verified?.exp, Math.floor(now / 1000) + 600);
});

test("GitHub install state rejects invalid installation identifiers", async () => {
  const signed = await createGitHubInstallState({
    userId: "user_01",
    secret: stateSecret,
    now,
  });

  await assert.rejects(
    bindGitHubInstallationToState({
      state: signed.state,
      secret: stateSecret,
      expectedUserId: "user_01",
      expectedNonce: signed.nonce,
      installationId: 0,
      now,
    }),
    /invalid_github_installation_id/,
  );
});
