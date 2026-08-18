import { createGitHubInstallState } from "@/lib/github-install-state";
import { mutableRedirect } from "@/lib/http-response";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { env } from "cloudflare:workers";
import { cookies } from "next/headers";

const nonceCookie = "dsh-github-install";

type GitHubInstallEnv = {
  GITHUB_APP_SLUG?: string;
  GITHUB_OAUTH_STATE_SECRET?: string;
  GITHUB_REDIRECT_URI?: string;
};

export async function GET(request: Request) {
  const { user } = await withAuth({ ensureSignedIn: true });
  const runtime = env as unknown as GitHubInstallEnv;
  if (
    !runtime.GITHUB_APP_SLUG ||
    !runtime.GITHUB_OAUTH_STATE_SECRET ||
    !runtime.GITHUB_REDIRECT_URI
  ) {
    return Response.json({ error: "github_app_not_configured" }, { status: 503 });
  }
  const signed = await createGitHubInstallState({
    userId: user.id,
    secret: runtime.GITHUB_OAUTH_STATE_SECRET,
  });
  const cookieStore = await cookies();
  cookieStore.set(nonceCookie, signed.nonce, {
    httpOnly: true,
    sameSite: "lax",
    secure: new URL(request.url).protocol === "https:",
    path: "/integrations/github/oauth/callback",
    maxAge: 600,
  });
  const installUrl = new URL(
    `https://github.com/apps/${runtime.GITHUB_APP_SLUG}/installations/new`,
  );
  installUrl.searchParams.set("state", signed.state);
  installUrl.searchParams.set("redirect_uri", runtime.GITHUB_REDIRECT_URI);
  return mutableRedirect(installUrl, 302);
}
