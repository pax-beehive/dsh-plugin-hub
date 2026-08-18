const secret = (
  process.env.WAITLIST_ADMIN_TOKEN ||
  process.env.CLOUDFLARE_EMAIL_API_TOKEN
)?.trim();
const configuredOrigin =
  process.env.CLOUDFLARE_PRODUCTION_DOMAIN || "https://dshpluginhub.ai";
const origin = (
  /^https?:\/\//i.test(configuredOrigin)
    ? configuredOrigin
    : `https://${configuredOrigin}`
).replace(/\/$/, "");

if (!secret) {
  console.error(
    "WAITLIST_ADMIN_TOKEN or CLOUDFLARE_EMAIL_API_TOKEN is missing from .env",
  );
  process.exitCode = 1;
} else {
  const bytes = new TextEncoder().encode(
    `pluginhub-waitlist-stats:${secret}`,
  );
  const token = Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
  const response = await fetch(`${origin}/api/admin/waitlist/stats`, {
    headers: { authorization: `Bearer ${token}` },
  });
  const result = await response.json();

  if (!response.ok) {
    console.error(`Waitlist stats request failed (${response.status})`);
    process.exitCode = 1;
  } else {
    console.log(JSON.stringify(result, null, 2));
  }
}
