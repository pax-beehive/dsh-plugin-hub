const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const ABUSE_REPORT_CATEGORIES = new Set([
  "malicious_code",
  "copyright",
  "security",
  "spam",
  "other",
] as const);

export type AbuseReportCategory =
  | "malicious_code"
  | "copyright"
  | "security"
  | "spam"
  | "other";

export type AbuseReportRecord = {
  id: string;
  packageName: string | null;
  reportedUrl: string | null;
  category: AbuseReportCategory;
  description: string;
  reporterEmail: string | null;
};

export interface AbuseReportStore {
  consumeRateLimit(
    key: string,
  ): Promise<{ allowed: boolean; retryAfterSeconds: number }>;
  createReport(input: Omit<AbuseReportRecord, "id">): Promise<AbuseReportRecord>;
}

type AbuseReportHandlerDependencies = {
  store: AbuseReportStore;
  rateLimitSalt: string;
  verifyTurnstile(input: {
    token: string;
    remoteIp: string | null;
  }): Promise<boolean>;
};

type AbuseReportPayload = {
  packageName?: unknown;
  reportedUrl?: unknown;
  category?: unknown;
  description?: unknown;
  reporterEmail?: unknown;
  turnstileToken?: unknown;
  website?: unknown;
};

export function createAbuseReportHandler(
  dependencies: AbuseReportHandlerDependencies,
) {
  return async function handleAbuseReport(request: Request): Promise<Response> {
    if (!isSameOrigin(request)) {
      return Response.json({ error: "invalid_origin" }, { status: 403 });
    }

    if (!request.headers.get("content-type")?.includes("application/json")) {
      return Response.json({ error: "invalid_content_type" }, { status: 415 });
    }

    let payload: AbuseReportPayload;
    try {
      payload = (await request.json()) as AbuseReportPayload;
    } catch {
      return Response.json({ error: "invalid_json" }, { status: 400 });
    }

    // Honeypot: bots that fill the hidden "website" field get a fake success.
    if (typeof payload.website === "string" && payload.website.trim()) {
      return Response.json({ status: "received" }, { status: 201 });
    }

    const description = boundedString(payload.description, 2000);
    if (!description || description.length < 10) {
      return Response.json(
        { error: "invalid_description" },
        { status: 400 },
      );
    }

    const category = normalizeCategory(payload.category);
    if (!category) {
      return Response.json({ error: "invalid_category" }, { status: 400 });
    }

    const remoteIp = request.headers.get("cf-connecting-ip")?.trim() || null;
    const turnstileToken = boundedString(payload.turnstileToken, 2048);
    if (
      !turnstileToken ||
      !(await dependencies.verifyTurnstile({
        token: turnstileToken,
        remoteIp,
      }))
    ) {
      return Response.json({ error: "challenge_failed" }, { status: 403 });
    }

    const reporterEmail = normalizeEmail(payload.reporterEmail);
    const [ipRateLimitKey, emailRateLimitKey] = await Promise.all([
      hashRateLimitKey(
        `report:ip:${remoteIp ?? "unknown"}`,
        dependencies.rateLimitSalt,
      ),
      reporterEmail
        ? hashRateLimitKey(
            `report:email:${reporterEmail}`,
            dependencies.rateLimitSalt,
          )
        : Promise.resolve(null),
    ]);

    const ipRateLimit =
      await dependencies.store.consumeRateLimit(ipRateLimitKey);
    const emailRateLimit = emailRateLimitKey
      ? await dependencies.store.consumeRateLimit(emailRateLimitKey)
      : { allowed: true, retryAfterSeconds: 0 };

    if (!ipRateLimit.allowed || !emailRateLimit.allowed) {
      const retryAfterSeconds = Math.max(
        ipRateLimit.retryAfterSeconds,
        emailRateLimit.retryAfterSeconds,
      );
      return Response.json(
        { error: "rate_limited" },
        {
          status: 429,
          headers: { "retry-after": String(retryAfterSeconds) },
        },
      );
    }

    const report = await dependencies.store.createReport({
      packageName: boundedString(payload.packageName, 200),
      reportedUrl: boundedString(payload.reportedUrl, 500),
      category,
      description,
      reporterEmail,
    });

    return Response.json(
      { status: "received", reportId: report.id },
      { status: 201 },
    );
  };
}

function normalizeCategory(value: unknown): AbuseReportCategory | null {
  if (typeof value !== "string") return null;
  return ABUSE_REPORT_CATEGORIES.has(value as AbuseReportCategory)
    ? (value as AbuseReportCategory)
    : null;
}

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (!email || email.length > 254 || !EMAIL_PATTERN.test(email)) return null;
  return email;
}

function boundedString(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized ? normalized.slice(0, maxLength) : null;
}

function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

async function hashRateLimitKey(value: string, salt: string) {
  const bytes = new TextEncoder().encode(`${salt}:${value}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
