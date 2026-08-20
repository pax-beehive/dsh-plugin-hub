import { claimGitHubInstallation, GitHubClaimError } from "@/lib/github-app";
import { HttpGitHubClaimStore } from "@/lib/hub-internal";
import { planGitHubOAuthCallback } from "@/lib/github-oauth-callback";
import { mutableRedirect } from "@/lib/http-response";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { env } from "cloudflare:workers";
import { cookies } from "next/headers";

const nonceCookie = "dsh-github-install";

type GitHubOAuthEnv = {
  GITHUB_APP_ID?: string;
  GITHUB_APP_SLUG?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  GITHUB_OAUTH_STATE_SECRET?: string;
  GITHUB_REDIRECT_URI?: string;
};

export async function GET(request: Request) {
  const { user } = await withAuth({ ensureSignedIn: true });
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const queryInstallationId = url.searchParams.get("installation_id");
  const cookieStore = await cookies();
  const cookieNonce = cookieStore.get(nonceCookie)?.value;
  const runtime = env as unknown as GitHubOAuthEnv;

  let clearNonce = true;
  try {
    const appId = Number(runtime.GITHUB_APP_ID);
    if (
      !state ||
      !cookieNonce ||
      !Number.isSafeInteger(appId) ||
      !runtime.GITHUB_APP_SLUG ||
      !runtime.GITHUB_CLIENT_ID ||
      !runtime.GITHUB_CLIENT_SECRET ||
      !runtime.GITHUB_OAUTH_STATE_SECRET ||
      !runtime.GITHUB_REDIRECT_URI
    ) {
      throw new GitHubClaimError("invalid_state");
    }
    const plan = await planGitHubOAuthCallback({
      code,
      state,
      queryInstallationId,
      cookieNonce,
      workosUserId: user.id,
      stateSecret: runtime.GITHUB_OAUTH_STATE_SECRET,
      clientId: runtime.GITHUB_CLIENT_ID,
      redirectUri: runtime.GITHUB_REDIRECT_URI,
    });
    if (!plan) throw new GitHubClaimError("invalid_state");
    if (plan.kind === "authorize") {
      clearNonce = false;
      return mutableRedirect(plan.url, 302);
    }
    await claimGitHubInstallation({
      code: code!,
      state,
      installationId: plan.installationId,
      cookieNonce,
      workosUserId: user.id,
      config: {
        appId,
        appSlug: runtime.GITHUB_APP_SLUG,
        clientId: runtime.GITHUB_CLIENT_ID,
        clientSecret: runtime.GITHUB_CLIENT_SECRET,
        stateSecret: runtime.GITHUB_OAUTH_STATE_SECRET,
        redirectUri: runtime.GITHUB_REDIRECT_URI,
      },
      store: new HttpGitHubClaimStore(),
    });
    return mutableRedirect(new URL("/dashboard?github=connected", request.url), 303);
  } catch (error) {
    const code = error instanceof GitHubClaimError ? error.code : "connection_failed";
    return mutableRedirect(
      new URL(`/dashboard?github=${encodeURIComponent(code)}`, request.url),
      303,
    );
  } finally {
    if (clearNonce) {
      cookieStore.set(nonceCookie, "", {
        expires: new Date(0),
        httpOnly: true,
        sameSite: "lax",
        secure: new URL(request.url).protocol === "https:",
        path: "/integrations/github/oauth/callback",
      });
    }
  }
}
