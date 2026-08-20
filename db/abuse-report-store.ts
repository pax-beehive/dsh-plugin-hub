import * as schema from "./schema.ts";
import { abuseReports, waitlistRateLimits } from "./schema.ts";
import type {
  AbuseReportRecord,
  AbuseReportStore,
} from "@/lib/abuse-report-service";
import { sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_ATTEMPTS = 5;

export class D1AbuseReportStore implements AbuseReportStore {
  private readonly db: DrizzleD1Database<typeof schema>;

  constructor(db: DrizzleD1Database<typeof schema>) {
    this.db = db;
  }

  async consumeRateLimit(key: string) {
    const now = Date.now();
    const windowStartedAt =
      Math.floor(now / RATE_LIMIT_WINDOW_MS) * RATE_LIMIT_WINDOW_MS;
    const bucketKey = `${key}:${windowStartedAt}`;
    const rows = await this.db
      .insert(waitlistRateLimits)
      .values({ key: bucketKey, attempts: 1, windowStartedAt })
      .onConflictDoUpdate({
        target: waitlistRateLimits.key,
        set: { attempts: sql`${waitlistRateLimits.attempts} + 1` },
      })
      .returning({ attempts: waitlistRateLimits.attempts });
    const attempts = rows[0]?.attempts ?? RATE_LIMIT_MAX_ATTEMPTS + 1;
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((windowStartedAt + RATE_LIMIT_WINDOW_MS - now) / 1000),
    );

    return {
      allowed: attempts <= RATE_LIMIT_MAX_ATTEMPTS,
      retryAfterSeconds,
    };
  }

  async createReport(
    input: Omit<AbuseReportRecord, "id">,
  ): Promise<AbuseReportRecord> {
    const id = crypto.randomUUID();
    await this.db.insert(abuseReports).values({
      id,
      packageName: input.packageName,
      reportedUrl: input.reportedUrl,
      category: input.category,
      description: input.description,
      reporterEmail: input.reporterEmail,
      status: "open",
    });
    return { ...input, id };
  }
}
