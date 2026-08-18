import * as schema from "./schema.ts";
import { waitlistRateLimits, waitlistSignups } from "./schema.ts";
import type {
  FollowupUpdate,
  SubscriptionRecord,
  SubscriptionResult,
  WaitlistStore,
} from "@/lib/waitlist-service";
import { and, eq, isNotNull, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_ATTEMPTS = 8;

export class D1WaitlistStore implements WaitlistStore {
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

  async subscribe(
    input: Omit<SubscriptionRecord, "id">,
  ): Promise<SubscriptionResult> {
    const existing = await this.db
      .select()
      .from(waitlistSignups)
      .where(eq(waitlistSignups.email, input.email))
      .limit(1);
    const current = existing[0];

    if (current && !current.unsubscribedAt) {
      return {
        status: "already_subscribed",
        record: toSubscriptionRecord(current),
      };
    }

    if (current) {
      const reactivated = await this.db
        .update(waitlistSignups)
        .set({
          locale: input.locale,
          source: input.source,
          referrer: input.referrer,
          utmSource: input.utmSource,
          utmMedium: input.utmMedium,
          utmCampaign: input.utmCampaign,
          consentVersion: input.consentVersion,
          unsubscribeToken: input.unsubscribeToken,
          unsubscribedAt: null,
          resubscribedAt: sql`CURRENT_TIMESTAMP`,
          followupStatus: "pending",
          followupAttempts: 0,
          followupResult: null,
          followupLastError: null,
          followupSentAt: null,
        })
        .where(
          and(
            eq(waitlistSignups.email, input.email),
            isNotNull(waitlistSignups.unsubscribedAt),
          ),
        )
        .returning();

      if (reactivated[0]) {
        return {
          status: "reactivated",
          record: toSubscriptionRecord(reactivated[0]),
        };
      }

      const active = await this.db
        .select()
        .from(waitlistSignups)
        .where(eq(waitlistSignups.email, input.email))
        .limit(1);
      return {
        status: "already_subscribed",
        record: toSubscriptionRecord(active[0] ?? current),
      };
    }

    const inserted = await this.db
      .insert(waitlistSignups)
      .values({
        id: crypto.randomUUID(),
        email: input.email,
        locale: input.locale,
        source: input.source,
        referrer: input.referrer,
        utmSource: input.utmSource,
        utmMedium: input.utmMedium,
        utmCampaign: input.utmCampaign,
        consentVersion: input.consentVersion,
        unsubscribeToken: input.unsubscribeToken,
        followupStatus: "pending",
      })
      .onConflictDoNothing({ target: waitlistSignups.email })
      .returning();

    if (!inserted[0]) {
      const active = await this.db
        .select()
        .from(waitlistSignups)
        .where(eq(waitlistSignups.email, input.email))
        .limit(1);
      if (!active[0]) throw new Error("waitlist_insert_conflict_without_row");
      return {
        status: "already_subscribed",
        record: toSubscriptionRecord(active[0]),
      };
    }

    return { status: "created", record: toSubscriptionRecord(inserted[0]) };
  }

  async updateFollowup(id: string, update: FollowupUpdate) {
    if (update.status === "sent") {
      await this.db
        .update(waitlistSignups)
        .set({
          followupStatus: "sent",
          followupAttempts: update.attempts,
          followupResult: update.result ?? null,
          followupLastError: null,
          followupSentAt: sql`CURRENT_TIMESTAMP`,
        })
        .where(eq(waitlistSignups.id, id));
      return;
    }

    await this.db
      .update(waitlistSignups)
      .set({
        followupStatus: "failed",
        followupAttempts: update.attempts,
        followupLastError: update.error ?? "unknown_error",
      })
      .where(eq(waitlistSignups.id, id));
  }
}

function toSubscriptionRecord(
  row: typeof waitlistSignups.$inferSelect,
): SubscriptionRecord {
  return {
    id: row.id,
    email: row.email,
    locale: row.locale === "en" ? "en" : "zh",
    source: row.source,
    referrer: row.referrer,
    utmSource: row.utmSource,
    utmMedium: row.utmMedium,
    utmCampaign: row.utmCampaign,
    consentVersion: row.consentVersion,
    unsubscribeToken: row.unsubscribeToken ?? "",
    unsubscribedAt: row.unsubscribedAt,
  };
}
