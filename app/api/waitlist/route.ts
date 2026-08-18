import { getDb } from "@/db";
import { waitlistSignups } from "@/db/schema";

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

  try {
    const rows = await getDb()
      .insert(waitlistSignups)
      .values({
        id: crypto.randomUUID(),
        email,
        locale,
        source: "hero",
      })
      .onConflictDoNothing({ target: waitlistSignups.email })
      .returning({ id: waitlistSignups.id });

    return Response.json(
      { status: rows.length > 0 ? "subscribed" : "already_subscribed" },
      { status: rows.length > 0 ? 201 : 200 },
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
