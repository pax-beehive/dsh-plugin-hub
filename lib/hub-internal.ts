import { env } from "cloudflare:workers";
import type { GitHubClaimStore, VerifiedGitHubInstallation } from "./github-app";

// Server-to-server calls from auth callbacks into the Go Hub API.

function resolveInternalConfig(): { origin: string; token: string } {
  const origin = env.HUB_API_ORIGIN ?? process.env.HUB_API_ORIGIN;
  const token = env.HUB_INTERNAL_TOKEN ?? process.env.HUB_INTERNAL_TOKEN;
  if (!origin || !token) {
    throw new Error(
      "Hub internal API is unavailable: set HUB_API_ORIGIN and HUB_INTERNAL_TOKEN.",
    );
  }
  return { origin: origin.replace(/\/$/, ""), token };
}

async function postInternal(path: string, body: unknown): Promise<void> {
  const { origin, token } = resolveInternalConfig();
  const response = await fetch(`${origin}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `Hub internal API ${response.status}: ${detail.slice(0, 300)}`,
    );
  }
}

export async function upsertHubWorkosUser(input: {
  workosUserId: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
}): Promise<void> {
  await postInternal("/internal/identity/upsert-user", input);
}

/** GitHubClaimStore implementation that persists via the Hub API. */
export class HttpGitHubClaimStore implements GitHubClaimStore {
  async saveInstallation(
    workosUserId: string,
    installation: VerifiedGitHubInstallation,
  ): Promise<void> {
    await postInternal("/internal/identity/save-installation", {
      workosUserId,
      installation,
    });
  }
}
