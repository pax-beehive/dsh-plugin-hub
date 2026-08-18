import { waitlistSignups } from "../db/schema.ts";
import * as schema from "../db/schema.ts";
import { desc, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { hasValidAdminBearer } from "./admin-auth.ts";

type WaitlistStatsDependencies = {
  adminSecret: string | undefined;
  getDatabase(): DrizzleD1Database<typeof schema>;
};

export function createWaitlistStatsHandler(
  dependencies: WaitlistStatsDependencies,
) {
  return async function handleWaitlistStats(request: Request) {
    if (
      !(await hasValidAdminBearer(
        request.headers.get("authorization"),
        dependencies.adminSecret,
      ))
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
      const db = dependencies.getDatabase();
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
            emailFailedLast24Hours: sql<number>`coalesce(sum(case when ${waitlistSignups.followupStatus} = 'failed' and coalesce(${waitlistSignups.resubscribedAt}, ${waitlistSignups.createdAt}) >= datetime('now', '-24 hours') then 1 else 0 end), 0)`,
            emailPendingOver15Minutes: sql<number>`coalesce(sum(case when ${waitlistSignups.followupStatus} in ('pending', 'not_sent') and coalesce(${waitlistSignups.resubscribedAt}, ${waitlistSignups.createdAt}) < datetime('now', '-15 minutes') then 1 else 0 end), 0)`,
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
            emailFailedLast24Hours: 0,
            emailPendingOver15Minutes: 0,
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
  };
}
