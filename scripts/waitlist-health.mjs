const secret = process.env.WAITLIST_ADMIN_TOKEN?.trim();
const configuredOrigin =
  process.env.CLOUDFLARE_PRODUCTION_DOMAIN || "https://dshpluginhub.ai";
const origin = (
  /^https?:\/\//i.test(configuredOrigin)
    ? configuredOrigin
    : `https://${configuredOrigin}`
).replace(/\/$/, "");
const maxFailedEmails = positiveInteger(
  process.env.WAITLIST_ALERT_MAX_FAILED_EMAILS,
  5,
);
const maxPendingEmails = positiveInteger(
  process.env.WAITLIST_ALERT_MAX_PENDING_EMAILS,
  10,
);

if (!secret) {
  console.error("WAITLIST_ADMIN_TOKEN is missing from .env");
  process.exitCode = 1;
} else {
  try {
    const healthResponse = await fetch(`${origin}/api/health`, {
      headers: { accept: "application/json" },
    });
    const health = await healthResponse.json();
    if (!healthResponse.ok || health.status !== "ok") {
      throw new Error(`health endpoint returned ${healthResponse.status}`);
    }

    const bytes = new TextEncoder().encode(
      `pluginhub-waitlist-stats:${secret}`,
    );
    const token = Array.from(
      new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
      (byte) => byte.toString(16).padStart(2, "0"),
    ).join("");
    const statsResponse = await fetch(`${origin}/api/admin/waitlist/stats`, {
      headers: { authorization: `Bearer ${token}` },
    });
    const stats = await statsResponse.json();
    if (!statsResponse.ok) {
      throw new Error(`stats endpoint returned ${statsResponse.status}`);
    }

    const failures = Number(stats.summary?.emailFailed ?? 0);
    const pending = Number(stats.summary?.emailPending ?? 0);
    const alerts = [];
    if (failures >= maxFailedEmails) {
      alerts.push(`email failures ${failures} >= ${maxFailedEmails}`);
    }
    if (pending >= maxPendingEmails) {
      alerts.push(`pending emails ${pending} >= ${maxPendingEmails}`);
    }
    if (alerts.length > 0) {
      throw new Error(alerts.join("; "));
    }

    console.log(
      JSON.stringify({
        status: "ok",
        origin,
        generatedAt: stats.generatedAt,
        active: stats.summary?.active ?? 0,
        emailFailed: failures,
        emailPending: pending,
      }),
    );
  } catch (error) {
    console.error(
      `Waitlist health check failed: ${error instanceof Error ? error.message : "unknown error"}`,
    );
    process.exitCode = 1;
  }
}

function positiveInteger(value, fallback) {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
