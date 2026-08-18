import assert from "node:assert/strict";
import { generateKeyPairSync, verify as verifySignature } from "node:crypto";
import test from "node:test";
import {
  claimGitHubInstallation,
  createGitHubAppJwt,
  GitHubClaimError,
  type VerifiedGitHubInstallation,
} from "../lib/github-app.ts";
import { createGitHubInstallState } from "../lib/github-install-state.ts";

const stateSecret = "test-secret-with-at-least-thirty-two-characters";
const config = {
  clientId: "Iv1.test",
  clientSecret: "github-client-secret",
  appId: 4_631_702,
  appSlug: "pax-dsh-hub",
  stateSecret,
  redirectUri: "https://staging.dshpluginhub.ai/integrations/github/oauth/callback",
};
const now = Date.UTC(2026, 7, 18, 12, 0, 0);

test("GitHub App JWT is short-lived, app-bound, and RSA signed", async () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const jwt = await createGitHubAppJwt({
    appId: 4_631_702,
    privateKey: privateKey.export({ type: "pkcs1", format: "pem" }).toString(),
    now,
  });
  const [header, payload, signature] = jwt.split(".") as [string, string, string];
  const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));

  assert.deepEqual(JSON.parse(Buffer.from(header, "base64url").toString("utf8")), {
    alg: "RS256",
    typ: "JWT",
  });
  assert.equal(claims.iss, "4631702");
  assert.equal(claims.iat, Math.floor(now / 1000) - 60);
  assert.equal(claims.exp, Math.floor(now / 1000) + 540);
  assert.equal(
    verifySignature(
      "RSA-SHA256",
      Buffer.from(`${header}.${payload}`),
      publicKey,
      Buffer.from(signature, "base64url"),
    ),
    true,
  );
});

async function createClaimInput(fetcher: typeof fetch, installationId = 154_560_008) {
  const signed = await createGitHubInstallState({
    userId: "user_01",
    secret: stateSecret,
    now,
  });
  const saved: VerifiedGitHubInstallation[] = [];
  return {
    saved,
    input: {
      code: "temporary-oauth-code",
      state: signed.state,
      installationId,
      cookieNonce: signed.nonce,
      workosUserId: "user_01",
      config,
      fetcher,
      now,
      store: {
        async saveInstallation(
          workosUserId: string,
          installation: VerifiedGitHubInstallation,
        ) {
          assert.equal(workosUserId, "user_01");
          saved.push(installation);
        },
      },
    },
  };
}

test("GitHub App claim stores only installations visible to the signed-in user", async () => {
  const requests: Array<{ url: string; authorization: string | null }> = [];
  const fetcher: typeof fetch = async (input, init) => {
    const url = String(input);
    requests.push({
      url,
      authorization: new Headers(init?.headers).get("authorization"),
    });
    if (url.endsWith("/login/oauth/access_token")) {
      assert.equal(
        JSON.parse(String(init?.body)).redirect_uri,
        config.redirectUri,
      );
      return Response.json({ access_token: "github-user-token" });
    }
    if (url.includes("/user/installations?")) {
      return Response.json({
        total_count: 1,
        installations: [
          {
            id: 154_560_008,
            app_id: 4_631_702,
            app_slug: "pax-dsh-hub",
            account: { login: "pax-beehive" },
            target_type: "Organization",
            repository_selection: "selected",
            suspended_at: null,
          },
        ],
      });
    }
    if (url.includes("/user/installations/154560008/repositories")) {
      return Response.json({
        repositories: [
          {
            id: 99,
            full_name: "pax-beehive/dsh-plugin-hub",
            private: true,
            default_branch: "main",
          },
        ],
      });
    }
    return new Response(null, { status: 404 });
  };
  const { input, saved } = await createClaimInput(fetcher);

  const installation = await claimGitHubInstallation(input);

  assert.equal(installation.accountLogin, "pax-beehive");
  assert.equal(installation.repositories[0]?.fullName, "pax-beehive/dsh-plugin-hub");
  assert.deepEqual(saved, [installation]);
  assert.equal(requests[0]?.authorization, null);
  assert.equal(requests[1]?.authorization, "Bearer github-user-token");
  assert.equal(requests[2]?.authorization, "Bearer github-user-token");
});

test("GitHub App claim rejects a spoofed installation_id before listing repositories", async () => {
  const urls: string[] = [];
  const fetcher: typeof fetch = async (input) => {
    const url = String(input);
    urls.push(url);
    if (url.endsWith("/login/oauth/access_token")) {
      return Response.json({ access_token: "github-user-token" });
    }
    return Response.json({ total_count: 0, installations: [] });
  };
  const { input, saved } = await createClaimInput(fetcher, 666);

  await assert.rejects(
    claimGitHubInstallation(input),
    (error: unknown) =>
      error instanceof GitHubClaimError &&
      error.code === "installation_not_accessible",
  );
  assert.equal(urls.some((url) => url.includes("/repositories")), false);
  assert.deepEqual(saved, []);
});

test("GitHub App claim rejects installations owned by another app", async () => {
  const fetcher: typeof fetch = async (input) => {
    const url = String(input);
    if (url.endsWith("/login/oauth/access_token")) {
      return Response.json({ access_token: "github-user-token" });
    }
    return Response.json({
      total_count: 1,
      installations: [
        {
          id: 154_560_008,
          app_id: 123,
          app_slug: "another-app",
          account: { login: "attacker" },
          target_type: "User",
          repository_selection: "all",
          suspended_at: null,
        },
      ],
    });
  };
  const { input, saved } = await createClaimInput(fetcher);

  await assert.rejects(
    claimGitHubInstallation(input),
    (error: unknown) =>
      error instanceof GitHubClaimError &&
      error.code === "installation_not_accessible",
  );
  assert.deepEqual(saved, []);
});
