export interface GitHubInstallState {
  v: 1;
  sub: string;
  nonce: string;
  exp: number;
  installationId?: number;
}

export async function createGitHubInstallState(input: {
  userId: string;
  secret: string;
  ttlSeconds?: number;
  now?: number;
}): Promise<{ state: string; nonce: string }> {
  assertSecret(input.secret);
  const nonce = crypto.randomUUID();
  const payload: GitHubInstallState = {
    v: 1,
    sub: input.userId,
    nonce,
    exp: Math.floor((input.now ?? Date.now()) / 1000) + (input.ttlSeconds ?? 600),
  };
  const encoded = encodeBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = await sign(encoded, input.secret);
  return { state: `${encoded}.${encodeBase64Url(signature)}`, nonce };
}

export async function verifyGitHubInstallState(input: {
  state: string;
  secret: string;
  expectedUserId: string;
  expectedNonce: string;
  now?: number;
}): Promise<GitHubInstallState | null> {
  assertSecret(input.secret);
  const [encoded, signature, extra] = input.state.split(".");
  if (!encoded || !signature || extra) return null;
  let signatureBytes: Uint8Array<ArrayBuffer>;
  let payloadBytes: Uint8Array<ArrayBuffer>;
  try {
    signatureBytes = decodeBase64Url(signature);
    payloadBytes = decodeBase64Url(encoded);
  } catch {
    return null;
  }
  if (
    encodeBase64Url(signatureBytes) !== signature ||
    encodeBase64Url(payloadBytes) !== encoded
  ) {
    return null;
  }
  const key = await importHmacKey(input.secret);
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    signatureBytes,
    new TextEncoder().encode(encoded),
  );
  if (!valid) return null;
  let payload: unknown;
  try {
    payload = JSON.parse(new TextDecoder().decode(payloadBytes));
  } catch {
    return null;
  }
  if (!isState(payload)) return null;
  if (payload.sub !== input.expectedUserId || payload.nonce !== input.expectedNonce) return null;
  if (payload.exp <= Math.floor((input.now ?? Date.now()) / 1000)) return null;
  return payload;
}

export async function bindGitHubInstallationToState(input: {
  state: string;
  secret: string;
  expectedUserId: string;
  expectedNonce: string;
  installationId: number;
  now?: number;
}): Promise<string | null> {
  if (!Number.isSafeInteger(input.installationId) || input.installationId <= 0) {
    throw new Error("invalid_github_installation_id");
  }
  const payload = await verifyGitHubInstallState(input);
  if (!payload) return null;
  if (
    payload.installationId !== undefined &&
    payload.installationId !== input.installationId
  ) {
    return null;
  }
  const bound: GitHubInstallState = {
    ...payload,
    installationId: input.installationId,
  };
  const encoded = encodeBase64Url(
    new TextEncoder().encode(JSON.stringify(bound)),
  );
  const signature = await sign(encoded, input.secret);
  return `${encoded}.${encodeBase64Url(signature)}`;
}

async function sign(payload: string, secret: string): Promise<ArrayBuffer> {
  const key = await importHmacKey(secret);
  return crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
}

function importHmacKey(secret: string) {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function assertSecret(secret: string) {
  if (secret.length < 32) throw new Error("github_oauth_state_secret_too_short");
}

function isState(value: unknown): value is GitHubInstallState {
  if (!value || typeof value !== "object") return false;
  const state = value as Record<string, unknown>;
  return (
    state.v === 1 &&
    typeof state.sub === "string" &&
    typeof state.nonce === "string" &&
    typeof state.exp === "number" &&
    (state.installationId === undefined ||
      (Number.isSafeInteger(state.installationId) &&
        (state.installationId as number) > 0))
  );
}

function encodeBase64Url(value: ArrayBuffer | Uint8Array): string {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodeBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
