import { getDb } from "@/db";
import { waitlistSignups } from "@/db/schema";
import { desc, sql } from "drizzle-orm";
import { env } from "cloudflare:workers";

type RuntimeAdminEnv = {
  CLOUDFLARE_EMAIL_API_TOKEN?: string;
  WAITLIST_ADMIN_TOKEN?: string;
};

export async function GET(request: Request) {
  const runtime = env as unknown as RuntimeAdminEnv;
  const adminSecret =
    runtime.WAITLIST_ADMIN_TOKEN ?? runtime.CLOUDFLARE_EMAIL_API_TOKEN;
  const expectedToken = adminSecret
    ? await deriveBearerToken(adminSecret)
    : undefined;
  const suppliedToken = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "")
    .trim();

  if (
    !expectedToken ||
    !suppliedToken ||
    !constantTimeEqual(suppliedToken, expectedToken)
  ) {
    return Response.json(
      { error: "unauthorized" },
      {
        status: 401,
        headers: {
          "cache-control": "no-store",
          "www-authenticate": "Bearer",
        },
      },
    );
  }

  try {
    const db = getDb();
    const [summaryRows, localeRows, sourceRows, dailyRows] = await Promise.all([
      db
        .select({
          total: sql<number>`count(*)`,
          active: sql<number>`coalesce(sum(case when ${waitlistSignups.unsubscribedAt} is null then 1 else 0 end), 0)`,
          unsubscribed: sql<number>`coalesce(sum(case when ${waitlistSignups.unsubscribedAt} is not null then 1 else 0 end), 0)`,
          emailSent: sql<number>`coalesce(sum(case when ${waitlistSignups.followupStatus} = 'sent' then 1 else 0 end), 0)`,
          emailFailed: sql<number>`coalesce(sum(case when ${waitlistSignups.followupStatus} = 'failed' then 1 else 0 end), 0)`,
        })
        .from(waitlistSignups),
      db
        .select({ locale: waitlistSignups.locale, count: sql<number>`count(*)` })
        .from(waitlistSignups)
        .groupBy(waitlistSignups.locale),
      db
        .select({
          source: waitlistSignups.source,
          count: sql<number>`count(*)`,
        })
        .from(waitlistSignups)
        .groupBy(waitlistSignups.source)
        .orderBy(desc(sql<number>`count(*)`))
        .limit(10),
      db
        .select({
          date: sql<string>`date(${waitlistSignups.createdAt})`,
          count: sql<number>`count(*)`,
        })
        .from(waitlistSignups)
        .where(sql`${waitlistSignups.createdAt} >= datetime('now', '-30 days')`)
        .groupBy(sql`date(${waitlistSignups.createdAt})`)
        .orderBy(sql`date(${waitlistSignups.createdAt})`),
    ]);

    return Response.json(
      {
        generatedAt: new Date().toISOString(),
        summary: summaryRows[0] ?? {
          total: 0,
          active: 0,
          unsubscribed: 0,
          emailSent: 0,
          emailFailed: 0,
        },
        byLocale: localeRows,
        topSources: sourceRows.map((row) => ({
          source: row.source,
          count: row.count,
        })),
        dailySignups: dailyRows,
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    console.error("waitlist_stats_failed", error);
    return Response.json(
      { error: "stats_unavailable" },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
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

async function deriveBearerToken(secret: string) {
  const bytes = new TextEncoder().encode(`pluginhub-waitlist-stats:${secret}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
