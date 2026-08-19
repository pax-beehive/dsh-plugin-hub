import {
  bindGitHubInstallationToState,
  verifyGitHubInstallState,
} from "./github-install-state.ts";

export type GitHubOAuthCallbackPlan =
  | { kind: "authorize"; url: string }
  | { kind: "claim"; installationId: number };

export async function planGitHubOAuthCallback(input: {
  code: string | null;
  state: string | null;
  queryInstallationId: string | null;
  cookieNonce: string;
  workosUserId: string;
  stateSecret: string;
  clientId: string;
  redirectUri: string;
  now?: number;
}): Promise<GitHubOAuthCallbackPlan | null> {
  if (!input.state) return null;
  const state = await verifyGitHubInstallState({
    state: input.state,
    secret: input.stateSecret,
    expectedUserId: input.workosUserId,
    expectedNonce: input.cookieNonce,
    now: input.now,
  });
  if (!state) return null;

  const queryInstallationId = parseInstallationId(input.queryInstallationId);
  if (
    state.installationId !== undefined &&
    queryInstallationId !== null &&
    state.installationId !== queryInstallationId
  ) {
    return null;
  }

  if (input.code) {
    const installationId = state.installationId ?? queryInstallationId;
    return installationId === null
      ? null
      : { kind: "claim", installationId };
  }

  if (queryInstallationId === null) return null;
  const reboundState = await bindGitHubInstallationToState({
    state: input.state,
    secret: input.stateSecret,
    expectedUserId: input.workosUserId,
    expectedNonce: input.cookieNonce,
    installationId: queryInstallationId,
    now: input.now,
  });
  if (!reboundState) return null;

  const authorizationUrl = new URL("https://github.com/login/oauth/authorize");
  authorizationUrl.searchParams.set("client_id", input.clientId);
  authorizationUrl.searchParams.set("redirect_uri", input.redirectUri);
  authorizationUrl.searchParams.set("state", reboundState);
  return { kind: "authorize", url: authorizationUrl.toString() };
}

function parseInstallationId(value: string | null): number | null {
  if (!value || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}
