export async function hasValidAdminBearer(
  authorizationHeader: string | null,
  secret: string | undefined,
) {
  const suppliedToken = authorizationHeader
    ?.replace(/^Bearer\s+/i, "")
    .trim();
  if (!secret || !suppliedToken) return false;

  return constantTimeEqual(suppliedToken, await deriveAdminBearer(secret));
}

export async function deriveAdminBearer(secret: string) {
  const bytes = new TextEncoder().encode(`pluginhub-waitlist-stats:${secret}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function constantTimeEqual(left: string, right: string) {
  const maxLength = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;
  for (let index = 0; index < maxLength; index += 1) {
    difference |=
      (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return difference === 0;
}
