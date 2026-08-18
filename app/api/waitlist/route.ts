import { getDb } from "@/db";
import { waitlistSignups } from "@/db/schema";
import { sendWelcomeEmail } from "@/lib/waitlist-email";
import { eq, sql } from "drizzle-orm";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type WaitlistPayload = {
  email?: unknown;
  locale?: unknown;
  website?: unknown;
};

export async function POST(request: Request) {
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

  // A visually hidden field catches simple form bots without storing their data.
  if (typeof payload.website === "string" && payload.website.trim()) {
    return Response.json({ status: "subscribed" }, { status: 201 });
  }

  const email = normalizeEmail(payload.email);
  if (!email) {
    return Response.json({ error: "invalid_email" }, { status: 400 });
  }

  const locale = payload.locale === "en" ? "en" : "zh";
  const signupId = crypto.randomUUID();
  const unsubscribeToken = crypto.randomUUID();

  try {
    const db = getDb();
    const rows = await db
      .insert(waitlistSignups)
      .values({
        id: signupId,
        email,
        locale,
        source: "hero",
        unsubscribeToken,
        followupStatus: "pending",
      })
      .onConflictDoNothing({ target: waitlistSignups.email })
      .returning({ id: waitlistSignups.id });

    if (rows.length === 0) {
      return Response.json({ status: "already_subscribed" }, { status: 200 });
    }

    let emailStatus: "sent" | "pending" = "pending";
    try {
      const unsubscribeUrl = new URL("/unsubscribe", new URL(request.url).origin);
      unsubscribeUrl.searchParams.set("token", unsubscribeToken);
      const result = await sendWelcomeEmail({
        email,
        locale,
        unsubscribeUrl: unsubscribeUrl.toString(),
      });

      await db
        .update(waitlistSignups)
        .set({
          followupStatus: "sent",
          followupAttempts: 1,
          followupResult: result.delivery,
          followupLastError: null,
          followupSentAt: sql`CURRENT_TIMESTAMP`,
        })
        .where(eq(waitlistSignups.id, signupId));
      emailStatus = "sent";
    } catch (error) {
      const message =
        error instanceof Error ? error.message.slice(0, 500) : "unknown_error";
      console.error("waitlist_followup_failed", message);
      await db
        .update(waitlistSignups)
        .set({
          followupStatus: "failed",
          followupAttempts: 1,
          followupLastError: message,
        })
        .where(eq(waitlistSignups.id, signupId));
    }

    return Response.json(
      { status: "subscribed", emailStatus },
      { status: 201 },
    );
  } catch (error) {
    console.error("waitlist_insert_failed", error);
    return Response.json({ error: "storage_unavailable" }, { status: 503 });
  }
}

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (!email || email.length > 254 || !EMAIL_PATTERN.test(email)) return null;
  return email;
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
