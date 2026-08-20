import { asc, desc, eq, lte, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "./schema.ts";
import { npmDiscoveryCursors, npmSyncPackages } from "./schema.ts";

export type NpmDiscoverySource = "manual" | "search" | "existing";
export type NpmSyncStatus = "pending" | "syncing" | "accepted" | "rejected" | "error";

export class D1NpmSyncStore {
  private readonly db: DrizzleD1Database<typeof schema>;

  constructor(db: DrizzleD1Database<typeof schema>) {
    this.db = db;
  }

  async recordCandidate(
    packageName: string,
    source: NpmDiscoverySource,
    now?: number,
  ) {
    // When the caller supplies a clock (cron/tests), persist the due time
    // explicitly in ISO form instead of relying on the CURRENT_TIMESTAMP
    // default, so due-ness never depends on wall-clock rollover between
    // candidate recording and the due query in the same run.
    const values: typeof npmSyncPackages.$inferInsert = {
      packageName,
      discoverySource: source,
      status: "pending",
    };
    if (now !== undefined) {
      values.nextSyncAt = new Date(now).toISOString();
    }
    await this.db
      .insert(npmSyncPackages)
      .values(values)
      .onConflictDoUpdate({
        target: npmSyncPackages.packageName,
        set: {
          discoverySource: source,
          updatedAt: sql`CURRENT_TIMESTAMP`,
        },
      });
  }

  async markSyncing(packageName: string) {
    await this.db
      .update(npmSyncPackages)
      .set({ status: "syncing", updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(eq(npmSyncPackages.packageName, packageName));
  }

  async markAccepted(input: {
    packageName: string;
    packageKind: "plugin" | "profile";
    npmModifiedAt?: string;
    now: number;
  }) {
    await this.db
      .update(npmSyncPackages)
      .set({
        status: "accepted",
        packageKind: input.packageKind,
        npmModifiedAt: input.npmModifiedAt,
        lastSyncedAt: new Date(input.now).toISOString(),
        nextSyncAt: new Date(input.now + 60 * 60 * 1000).toISOString(),
        lastError: null,
        consecutiveFailures: 0,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where(eq(npmSyncPackages.packageName, input.packageName));
  }

  async markRejected(packageName: string, reason: string, now: number) {
    await this.db
      .update(npmSyncPackages)
      .set({
        status: "rejected",
        lastSyncedAt: new Date(now).toISOString(),
        nextSyncAt: new Date(now + 24 * 60 * 60 * 1000).toISOString(),
        lastError: reason.slice(0, 300),
        consecutiveFailures: 0,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where(eq(npmSyncPackages.packageName, packageName));
  }

  async markFailed(packageName: string, reason: string, now: number) {
    const rows = await this.db
      .select({ failures: npmSyncPackages.consecutiveFailures })
      .from(npmSyncPackages)
      .where(eq(npmSyncPackages.packageName, packageName))
      .limit(1);
    const failures = Math.min((rows[0]?.failures ?? 0) + 1, 8);
    const delayMinutes = Math.min(2 ** failures * 5, 6 * 60);
    await this.db
      .update(npmSyncPackages)
      .set({
        status: "error",
        lastSyncedAt: new Date(now).toISOString(),
        nextSyncAt: new Date(now + delayMinutes * 60 * 1000).toISOString(),
        lastError: reason.slice(0, 300),
        consecutiveFailures: failures,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where(eq(npmSyncPackages.packageName, packageName));
  }

  async listDue(now: number, limit = 100): Promise<string[]> {
    const rows = await this.db
      .select({ packageName: npmSyncPackages.packageName })
      .from(npmSyncPackages)
      .where(lte(npmSyncPackages.nextSyncAt, new Date(now).toISOString()))
      .orderBy(asc(npmSyncPackages.nextSyncAt))
      .limit(Math.min(Math.max(limit, 1), 250));
    return rows.map((row) => row.packageName);
  }

  async getDiscoveryOffset(query: string): Promise<number> {
    const rows = await this.db
      .select({ nextOffset: npmDiscoveryCursors.nextOffset })
      .from(npmDiscoveryCursors)
      .where(eq(npmDiscoveryCursors.query, query))
      .limit(1);
    return rows[0]?.nextOffset ?? 0;
  }

  async setDiscoveryOffset(query: string, nextOffset: number, now: number) {
    await this.db
      .insert(npmDiscoveryCursors)
      .values({
        query,
        nextOffset,
        lastRunAt: new Date(now).toISOString(),
      })
      .onConflictDoUpdate({
        target: npmDiscoveryCursors.query,
        set: {
          nextOffset,
          lastRunAt: new Date(now).toISOString(),
          updatedAt: sql`CURRENT_TIMESTAMP`,
        },
      });
  }

  async find(packageName: string) {
    const rows = await this.db
      .select()
      .from(npmSyncPackages)
      .where(eq(npmSyncPackages.packageName, packageName))
      .limit(1);
    return rows[0] ?? null;
  }

  // Public transparency views for the /status page.
  async statusSummary(): Promise<Array<{ status: string; count: number }>> {
    const rows = await this.db.all<{ status: unknown; count: unknown }>(sql`
      SELECT status, COUNT(*) AS count
      FROM npm_sync_packages
      GROUP BY status
      ORDER BY count DESC
    `);
    return rows
      .filter((row): row is { status: string; count: number } =>
        typeof row.status === "string")
      .map((row) => ({ status: row.status, count: Number(row.count) }));
  }

  async recentlySynced(limit = 20): Promise<Array<{
    packageName: string;
    status: string;
    packageKind: string | null;
    lastSyncedAt: string | null;
    lastError: string | null;
  }>> {
    const rows = await this.db
      .select({
        packageName: npmSyncPackages.packageName,
        status: npmSyncPackages.status,
        packageKind: npmSyncPackages.packageKind,
        lastSyncedAt: npmSyncPackages.lastSyncedAt,
        lastError: npmSyncPackages.lastError,
      })
      .from(npmSyncPackages)
      .where(sql`${npmSyncPackages.lastSyncedAt} IS NOT NULL`)
      .orderBy(desc(npmSyncPackages.lastSyncedAt))
      .limit(Math.min(Math.max(limit, 1), 100));
    return rows;
  }
}
