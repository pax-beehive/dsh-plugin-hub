import { and, desc, eq, isNull, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "./schema.ts";
import { githubSourceListings, npmDiscoveryCursors } from "./schema.ts";

export interface GithubSourceListingInput {
  fullName: string;
  description: string;
  stars: number;
  language: string | null;
  license: string | null;
  topics: string[];
  homepage: string | null;
  pushedAt: string | null;
  discoveryTopic: string;
}

export interface GithubSourceListing {
  fullName: string;
  description: string;
  stars: number;
  language: string | null;
  license: string | null;
  topics: string[];
  homepage: string | null;
  pushedAt: string | null;
  linkedPackageName: string | null;
  discoveryTopic: string;
  firstSeenAt: string;
  lastSeenAt: string;
}

export class D1GithubSourceStore {
  private readonly db: DrizzleD1Database<typeof schema>;

  constructor(db: DrizzleD1Database<typeof schema>) {
    this.db = db;
  }

  async upsertListing(listing: GithubSourceListingInput, nowIso: string) {
    await this.db
      .insert(githubSourceListings)
      .values({
        fullName: listing.fullName,
        description: listing.description,
        stars: listing.stars,
        language: listing.language,
        license: listing.license,
        topicsJson: JSON.stringify(listing.topics),
        homepage: listing.homepage,
        pushedAt: listing.pushedAt,
        discoveryTopic: listing.discoveryTopic,
        firstSeenAt: nowIso,
        lastSeenAt: nowIso,
        updatedAt: nowIso,
      })
      .onConflictDoUpdate({
        target: githubSourceListings.fullName,
        set: {
          description: listing.description,
          stars: listing.stars,
          language: listing.language,
          license: listing.license,
          topicsJson: JSON.stringify(listing.topics),
          homepage: listing.homepage,
          pushedAt: listing.pushedAt,
          lastSeenAt: nowIso,
          updatedAt: nowIso,
        },
      });
  }

  // Connect source-only listings to accepted npm packages whose manifest
  // repository matches the GitHub full name. Runs after each discovery pass.
  async relinkAcceptedPlugins() {
    await this.db.run(sql`
      UPDATE github_source_listings
      SET linked_package_name = (
            SELECT package_name FROM plugins
            WHERE plugins.repository = github_source_listings.full_name
          ),
          updated_at = CURRENT_TIMESTAMP
      WHERE linked_package_name IS NULL
        AND EXISTS (
          SELECT 1 FROM plugins
          WHERE plugins.repository = github_source_listings.full_name
        )
    `);
  }

  // Public directory view: unlinked repositories only. Once a repository is
  // linked to an accepted npm package, the registry listing takes over.
  async listPublic(input: {
    query?: string;
    limit?: number;
  }): Promise<GithubSourceListing[]> {
    const limit = Math.min(Math.max(input.limit ?? 12, 1), 50);
    const pattern = `%${(input.query ?? "").replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
    const conditions = [isNull(githubSourceListings.linkedPackageName)];
    if (input.query) {
      conditions.push(
        sql<boolean>`(${githubSourceListings.fullName} LIKE ${pattern} ESCAPE '\\' OR ${githubSourceListings.description} LIKE ${pattern} ESCAPE '\\')`,
      );
    }
    const rows = await this.db
      .select()
      .from(githubSourceListings)
      .where(and(...conditions))
      .orderBy(desc(githubSourceListings.stars), desc(githubSourceListings.pushedAt))
      .limit(limit);
    return rows.map((row) => ({
      fullName: row.fullName,
      description: row.description,
      stars: row.stars,
      language: row.language,
      license: row.license,
      topics: parseTopics(row.topicsJson),
      homepage: row.homepage,
      pushedAt: row.pushedAt,
      linkedPackageName: row.linkedPackageName,
      discoveryTopic: row.discoveryTopic,
      firstSeenAt: row.firstSeenAt,
      lastSeenAt: row.lastSeenAt,
    }));
  }

  async countPublic(): Promise<number> {
    const rows = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(githubSourceListings)
      .where(isNull(githubSourceListings.linkedPackageName));
    return rows[0]?.count ?? 0;
  }

  async find(fullName: string): Promise<GithubSourceListing | null> {
    const rows = await this.db
      .select()
      .from(githubSourceListings)
      .where(eq(githubSourceListings.fullName, fullName))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    return {
      fullName: row.fullName,
      description: row.description,
      stars: row.stars,
      language: row.language,
      license: row.license,
      topics: parseTopics(row.topicsJson),
      homepage: row.homepage,
      pushedAt: row.pushedAt,
      linkedPackageName: row.linkedPackageName,
      discoveryTopic: row.discoveryTopic,
      firstSeenAt: row.firstSeenAt,
      lastSeenAt: row.lastSeenAt,
    };
  }

  // Discovery cursors ride on npm_discovery_cursors with a "github:" prefix
  // so both pipelines share one cursor table.
  async getCursor(key: string): Promise<number> {
    const rows = await this.db
      .select({ nextOffset: npmDiscoveryCursors.nextOffset })
      .from(npmDiscoveryCursors)
      .where(eq(npmDiscoveryCursors.query, key))
      .limit(1);
    return rows[0]?.nextOffset ?? 0;
  }

  async setCursor(key: string, nextOffset: number, nowIso: string) {
    await this.db
      .insert(npmDiscoveryCursors)
      .values({ query: key, nextOffset, lastRunAt: nowIso, updatedAt: nowIso })
      .onConflictDoUpdate({
        target: npmDiscoveryCursors.query,
        set: { nextOffset, lastRunAt: nowIso, updatedAt: nowIso },
      });
  }
}

function parseTopics(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((topic): topic is string => typeof topic === "string")
      : [];
  } catch {
    return [];
  }
}
