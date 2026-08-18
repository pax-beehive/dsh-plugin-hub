import type { WelcomeEmailResult } from "./waitlist-email.ts";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const WAITLIST_CONSENT_VERSION = "2026-08-17";

export type SubscriptionRecord = {
  id: string;
  email: string;
  locale: "en" | "zh";
  source: string;
  referrer: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  consentVersion: string;
  unsubscribeToken: string;
  unsubscribedAt: string | null;
};

export type SubscriptionResult = {
  status: "created" | "reactivated" | "already_subscribed";
  record: SubscriptionRecord;
};

export type FollowupUpdate = {
  status: "sent" | "failed";
  attempts: number;
  result?: string;
  error?: string;
};

export interface WaitlistStore {
  consumeRateLimit(
    key: string,
  ): Promise<{ allowed: boolean; retryAfterSeconds: number }>;
  subscribe(
    input: Omit<SubscriptionRecord, "id">,
  ): Promise<SubscriptionResult>;
  updateFollowup(id: string, update: FollowupUpdate): Promise<void>;
}

type WaitlistHandlerDependencies = {
  store: WaitlistStore;
  rateLimitSalt: string;
  turnstileRequired?: boolean;
  verifyTurnstile(input: {
    token: string;
    remoteIp: string | null;
  }): Promise<boolean>;
  sendWelcomeEmail(input: {
    email: string;
    locale: "en" | "zh";
    unsubscribeUrl: string;
  }): Promise<WelcomeEmailResult>;
  defer(promise: Promise<unknown>): void;
  sleep(milliseconds: number): Promise<void>;
};

type WaitlistPayload = {
  email?: unknown;
  locale?: unknown;
  website?: unknown;
  turnstileToken?: unknown;
  referrer?: unknown;
  utmSource?: unknown;
  utmMedium?: unknown;
  utmCampaign?: unknown;
};

export function createWaitlistHandler(dependencies: WaitlistHandlerDependencies) {
  return async function handleWaitlist(request: Request): Promise<Response> {
    if (!isSameOrigin(request)) {
      return Response.json({ error: "invalid_origin" }, { status: 403 });
    }

    if (!request.headers.get("content-type")?.includes("application/json")) {
      return Response.json({ error: "invalid_content_type" }, { status: 415 });
    }

    let payload: WaitlistPayload;
    try {
      payload = (await request.json()) as WaitlistPayload;
    } catch {
      return Response.json({ error: "invalid_json" }, { status: 400 });
    }

    if (typeof payload.website === "string" && payload.website.trim()) {
      return Response.json({ status: "subscribed" }, { status: 201 });
    }

    const email = normalizeEmail(payload.email);
    if (!email) {
      return Response.json({ error: "invalid_email" }, { status: 400 });
    }

    const remoteIp = request.headers.get("cf-connecting-ip")?.trim() || null;
    if (dependencies.turnstileRequired !== false) {
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
    }

    const rateLimitKey = await hashRateLimitKey(
      remoteIp ?? "unknown",
      dependencies.rateLimitSalt,
    );
    const rateLimit = await dependencies.store.consumeRateLimit(rateLimitKey);
    if (!rateLimit.allowed) {
      return Response.json(
        { error: "rate_limited" },
        {
          status: 429,
          headers: { "retry-after": String(rateLimit.retryAfterSeconds) },
        },
      );
    }

    const locale = payload.locale === "en" ? "en" : "zh";
    const unsubscribeToken = crypto.randomUUID();
    const result = await dependencies.store.subscribe({
      email,
      locale,
      source: sourceFrom(payload),
      referrer: boundedString(payload.referrer, 500),
      utmSource: boundedString(payload.utmSource, 100),
      utmMedium: boundedString(payload.utmMedium, 100),
      utmCampaign: boundedString(payload.utmCampaign, 150),
      consentVersion: WAITLIST_CONSENT_VERSION,
      unsubscribeToken,
      unsubscribedAt: null,
    });

    if (result.status === "already_subscribed") {
      return Response.json({ status: result.status }, { status: 200 });
    }

    const unsubscribeUrl = new URL("/unsubscribe", new URL(request.url).origin);
    unsubscribeUrl.searchParams.set("token", result.record.unsubscribeToken);
    dependencies.defer(
      deliverWelcomeEmail(dependencies, result.record, unsubscribeUrl.toString()),
    );

    return Response.json(
      { status: result.status, emailStatus: "queued" },
      { status: 201 },
    );
  };
}

async function deliverWelcomeEmail(
  dependencies: WaitlistHandlerDependencies,
  record: SubscriptionRecord,
  unsubscribeUrl: string,
) {
  let lastError = "unknown_error";

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const result = await dependencies.sendWelcomeEmail({
        email: record.email,
        locale: record.locale,
        unsubscribeUrl,
      });
      await dependencies.store.updateFollowup(record.id, {
        status: "sent",
        attempts: attempt,
        result: result.delivery,
      });
      return;
    } catch (error) {
      lastError =
        error instanceof Error
          ? error.message.slice(0, 500)
          : "unknown_error";
      if (attempt < 3) {
        await dependencies.sleep(attempt * 750);
      }
    }
  }

  await dependencies.store.updateFollowup(record.id, {
    status: "failed",
    attempts: 3,
    error: lastError,
  });
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

function sourceFrom(payload: WaitlistPayload) {
  const utmSource = boundedString(payload.utmSource, 80);
  if (utmSource) return `utm:${utmSource}`.slice(0, 100);

  const referrer = boundedString(payload.referrer, 500);
  if (referrer) {
    try {
      return `referral:${new URL(referrer).hostname}`.slice(0, 100);
    } catch {
      return "referral";
    }
  }

  return "direct";
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
