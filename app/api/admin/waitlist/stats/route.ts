import { getDb } from "@/db";
import { waitlistSignups } from "@/db/schema";
import { hasValidAdminBearer } from "@/lib/admin-auth";
import { desc, sql } from "drizzle-orm";
import { env } from "cloudflare:workers";

type RuntimeAdminEnv = {
  WAITLIST_ADMIN_TOKEN?: string;
};

export async function GET(request: Request) {
  const runtime = env as unknown as RuntimeAdminEnv;
  const adminSecret = runtime.WAITLIST_ADMIN_TOKEN;

  if (!(await hasValidAdminBearer(request.headers.get("authorization"), adminSecret))) {
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
          emailDelivered: sql<number>`coalesce(sum(case when ${waitlistSignups.followupStatus} = 'sent' and ${waitlistSignups.followupResult} = 'delivered' then 1 else 0 end), 0)`,
          emailQueued: sql<number>`coalesce(sum(case when ${waitlistSignups.followupStatus} = 'sent' and ${waitlistSignups.followupResult} = 'queued' then 1 else 0 end), 0)`,
          emailPending: sql<number>`coalesce(sum(case when ${waitlistSignups.followupStatus} in ('pending', 'not_sent') then 1 else 0 end), 0)`,
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
          emailDelivered: 0,
          emailQueued: 0,
          emailPending: 0,
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
