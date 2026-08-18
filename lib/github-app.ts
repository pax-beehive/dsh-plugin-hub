import { verifyGitHubInstallState } from "./github-install-state.ts";

const githubApiVersion = "2026-03-10";
const textEncoder = new TextEncoder();

export interface VerifiedGitHubInstallation {
  id: number;
  accountLogin: string;
  targetType: string;
  repositorySelection: string;
  suspendedAt: string | null;
  repositories: Array<{
    id: number;
    fullName: string;
    isPrivate: boolean;
    defaultBranch: string;
  }>;
}

export interface GitHubClaimStore {
  saveInstallation(
    workosUserId: string,
    installation: VerifiedGitHubInstallation,
  ): Promise<void>;
}

interface GitHubOAuthConfig {
  clientId: string;
  clientSecret: string;
  appId: number;
  appSlug: string;
  stateSecret: string;
  redirectUri: string;
}

export async function claimGitHubInstallation(input: {
  code: string;
  state: string;
  installationId: number;
  cookieNonce: string;
  workosUserId: string;
  config: GitHubOAuthConfig;
  store: GitHubClaimStore;
  fetcher?: typeof fetch;
  now?: number;
}): Promise<VerifiedGitHubInstallation> {
  const state = await verifyGitHubInstallState({
    state: input.state,
    secret: input.config.stateSecret,
    expectedUserId: input.workosUserId,
    expectedNonce: input.cookieNonce,
    now: input.now,
  });
  if (!state) throw new GitHubClaimError("invalid_state");

  const fetcher = input.fetcher ?? fetch;
  const token = await exchangeCode(fetcher, input.code, input.config);
  const installation = await findAccessibleInstallation(
    fetcher,
    token,
    input.installationId,
  );
  if (!installation || installation.app_id !== input.config.appId || installation.app_slug !== input.config.appSlug) {
    throw new GitHubClaimError("installation_not_accessible");
  }
  const repositories = await listAccessibleRepositories(
    fetcher,
    token,
    input.installationId,
  );
  const verified: VerifiedGitHubInstallation = {
    id: installation.id,
    accountLogin: installation.account.login,
    targetType: installation.target_type,
    repositorySelection: installation.repository_selection,
    suspendedAt: installation.suspended_at,
    repositories: repositories.map((repository) => ({
      id: repository.id,
      fullName: repository.full_name,
      isPrivate: repository.private,
      defaultBranch: repository.default_branch,
    })),
  };
  await input.store.saveInstallation(input.workosUserId, verified);
  return verified;
}

export class GitHubClaimError extends Error {
  readonly code: "invalid_state" | "oauth_exchange_failed" | "installation_not_accessible" | "github_api_failed";

  constructor(code: GitHubClaimError["code"]) {
    super(code);
    this.name = "GitHubClaimError";
    this.code = code;
  }
}

export async function createGitHubInstallationToken(input: {
  appId: number;
  privateKey: string;
  installationId: number;
  fetcher?: typeof fetch;
  now?: number;
}): Promise<{ token: string; expiresAt: string }> {
  const fetcher = input.fetcher ?? fetch;
  const jwt = await createGitHubAppJwt({
    appId: input.appId,
    privateKey: input.privateKey,
    now: input.now,
  });
  const response = await fetcher(
    `https://api.github.com/app/installations/${input.installationId}/access_tokens`,
    {
      method: "POST",
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${jwt}`,
        "x-github-api-version": githubApiVersion,
        "user-agent": "dsh-plugin-hub",
      },
    },
  );
  const body = (await response.json().catch(() => null)) as {
    token?: string;
    expires_at?: string;
  } | null;
  if (!response.ok || !body?.token || !body.expires_at) {
    throw new GitHubClaimError("github_api_failed");
  }
  return { token: body.token, expiresAt: body.expires_at };
}

export async function createGitHubAppJwt(input: {
  appId: number;
  privateKey: string;
  now?: number;
}): Promise<string> {
  if (!Number.isSafeInteger(input.appId) || input.appId <= 0) {
    throw new Error("invalid_github_app_id");
  }
  const now = Math.floor((input.now ?? Date.now()) / 1000);
  const header = encodeBase64Url(textEncoder.encode(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const payload = encodeBase64Url(
    textEncoder.encode(
      JSON.stringify({ iat: now - 60, exp: now + 9 * 60, iss: String(input.appId) }),
    ),
  );
  const signingInput = `${header}.${payload}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToPkcs8(input.privateKey),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    textEncoder.encode(signingInput),
  );
  return `${signingInput}.${encodeBase64Url(new Uint8Array(signature))}`;
}

async function exchangeCode(
  fetcher: typeof fetch,
  code: string,
  config: GitHubOAuthConfig,
): Promise<string> {
  const response = await fetcher("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: config.redirectUri,
    }),
  });
  const body = (await response.json().catch(() => null)) as { access_token?: string; error?: string } | null;
  if (!response.ok || !body?.access_token) throw new GitHubClaimError("oauth_exchange_failed");
  return body.access_token;
}

async function findAccessibleInstallation(
  fetcher: typeof fetch,
  token: string,
  installationId: number,
) {
  for (let page = 1; page <= 10; page += 1) {
    const response = await githubFetch(fetcher, token, `/user/installations?per_page=100&page=${page}`);
    const body = (await response.json()) as {
      total_count: number;
      installations: Array<{
        id: number;
        app_id: number;
        app_slug: string;
        account: { login: string };
        target_type: string;
        repository_selection: string;
        suspended_at: string | null;
      }>;
    };
    const found = body.installations.find((installation) => installation.id === installationId);
    if (found) return found;
    if (page * 100 >= body.total_count) return null;
  }
  return null;
}

async function listAccessibleRepositories(
  fetcher: typeof fetch,
  token: string,
  installationId: number,
) {
  const response = await githubFetch(
    fetcher,
    token,
    `/user/installations/${installationId}/repositories?per_page=100`,
  );
  const body = (await response.json()) as {
    repositories: Array<{
      id: number;
      full_name: string;
      private: boolean;
      default_branch: string;
    }>;
  };
  return body.repositories;
}

async function githubFetch(
  fetcher: typeof fetch,
  token: string,
  path: string,
): Promise<Response> {
  const response = await fetcher(`https://api.github.com${path}`, {
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "x-github-api-version": githubApiVersion,
      "user-agent": "dsh-plugin-hub",
    },
  });
  if (!response.ok) throw new GitHubClaimError("github_api_failed");
  return response;
}

function pemToPkcs8(pem: string): Uint8Array<ArrayBuffer> {
  const normalized = pem.replace(/\\n/g, "\n").trim();
  if (normalized.includes("-----BEGIN PRIVATE KEY-----")) {
    return decodePem(normalized, "PRIVATE KEY");
  }
  if (normalized.includes("-----BEGIN RSA PRIVATE KEY-----")) {
    const pkcs1 = decodePem(normalized, "RSA PRIVATE KEY");
    const version = Uint8Array.of(0x02, 0x01, 0x00);
    const rsaAlgorithm = Uint8Array.of(
      0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86,
      0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00,
    );
    return der(0x30, concat(version, rsaAlgorithm, der(0x04, pkcs1)));
  }
  throw new Error("invalid_github_private_key");
}

function decodePem(pem: string, label: string): Uint8Array<ArrayBuffer> {
  const base64 = pem
    .replace(`-----BEGIN ${label}-----`, "")
    .replace(`-----END ${label}-----`, "")
    .replace(/\s/g, "");
  const binary = atob(base64);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function der(tag: number, value: Uint8Array): Uint8Array<ArrayBuffer> {
  return concat(Uint8Array.of(tag), derLength(value.length), value);
}

function derLength(length: number): Uint8Array<ArrayBuffer> {
  if (length < 0x80) return Uint8Array.of(length);
  const bytes: number[] = [];
  let remaining = length;
  while (remaining > 0) {
    bytes.unshift(remaining & 0xff);
    remaining >>>= 8;
  }
  return Uint8Array.of(0x80 | bytes.length, ...bytes);
}

function concat(...parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const result = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function encodeBase64Url(value: Uint8Array): string {
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
