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

try {
  if (!secret) {
    throw new Error("WAITLIST_ADMIN_TOKEN is missing from .env");
  }

  const healthResponse = await fetch(`${origin}/api/health`, {
    headers: { accept: "application/json" },
  });
  const health = await healthResponse.json();
  if (!healthResponse.ok || health.status !== "ok") {
    throw new Error(`health endpoint returned ${healthResponse.status}`);
  }

  const bytes = new TextEncoder().encode(`pluginhub-waitlist-stats:${secret}`);
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

  const failures = Number(stats.summary?.emailFailedLast24Hours ?? 0);
  const pending = Number(stats.summary?.emailPendingOver15Minutes ?? 0);
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
      emailFailedLast24Hours: failures,
      emailPendingOver15Minutes: pending,
    }),
  );
} catch (error) {
  const message = `Waitlist health check failed: ${error instanceof Error ? error.message : "unknown error"}`;
  console.error(message);
  try {
    await sendAlertEmail(message);
  } catch (alertError) {
    console.error(
      `Waitlist alert delivery failed: ${alertError instanceof Error ? alertError.message : "unknown error"}`,
    );
  }
  process.exitCode = 1;
}

function positiveInteger(value, fallback) {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

async function sendAlertEmail(message) {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const apiToken = process.env.CLOUDFLARE_EMAIL_API_TOKEN?.trim();
  const from = process.env.WAITLIST_FROM_EMAIL?.trim();
  const to = process.env.WAITLIST_ALERT_TO_EMAIL?.trim();
  if (!accountId || !apiToken || !from || !to) {
    throw new Error("alert email configuration is incomplete");
  }

  const checkedAt = new Date().toISOString();
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/email/sending/send`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        to,
        from: {
          address: from,
          name: process.env.WAITLIST_FROM_NAME || "DeepSeek Plugin Hub",
        },
        subject: "[Plugin Hub] Waitlist health alert",
        text: `${message}\n\nChecked: ${checkedAt}\nOrigin: ${origin}`,
        html: `<p>${escapeHtml(message)}</p><p>Checked: ${checkedAt}<br>Origin: ${escapeHtml(origin)}</p>`,
      }),
    },
  );
  const result = await response.json().catch(() => null);
  if (!response.ok || result?.success !== true) {
    throw new Error(`email service returned ${response.status}`);
  }
}

function escapeHtml(value) {
  const entities = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return value.replace(/[&<>"']/g, (character) => entities[character]);
}
