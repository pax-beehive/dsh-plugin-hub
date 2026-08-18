import { and, asc, eq, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "./schema.ts";
import { hubUsers, plugins } from "./schema.ts";

export interface PluginListingUpdate {
  displayName: string;
  summary: string;
  description: string;
  homepage?: string;
  categories: string[];
  keywords: string[];
  screenshots: Array<{ url: string; alt: string }>;
  publisherMetadata: {
    compatibility?: {
      dsh?: string;
      hmr?: "full" | "config" | "refresh" | "restart";
    };
  };
}

export class D1PublisherStore {
  private readonly db: DrizzleD1Database<typeof schema>;

  constructor(db: DrizzleD1Database<typeof schema>) {
    this.db = db;
  }

  async listOwnedPlugins(workosUserId: string) {
    return this.db
      .select({
        slug: plugins.slug,
        packageName: plugins.packageName,
        displayName: plugins.displayName,
        latestVersion: plugins.latestVersion,
        repository: plugins.repository,
      })
      .from(plugins)
      .innerJoin(hubUsers, eq(plugins.ownerUserId, hubUsers.id))
      .where(eq(hubUsers.workosUserId, workosUserId))
      .orderBy(asc(plugins.slug));
  }

  async findOwnedPlugin(workosUserId: string, slug: string) {
    const rows = await this.db
      .select({
        slug: plugins.slug,
        packageName: plugins.packageName,
        displayName: plugins.displayName,
        summary: plugins.summary,
        description: plugins.description,
        homepage: plugins.homepage,
        categoriesJson: plugins.categoriesJson,
        keywordsJson: plugins.keywordsJson,
        screenshotsJson: plugins.screenshotsJson,
        publisherMetadataJson: plugins.publisherMetadataJson,
      })
      .from(plugins)
      .innerJoin(hubUsers, eq(plugins.ownerUserId, hubUsers.id))
      .where(and(eq(hubUsers.workosUserId, workosUserId), eq(plugins.slug, slug)))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    return {
      slug: row.slug,
      packageName: row.packageName,
      displayName: row.displayName,
      summary: row.summary,
      description: row.description,
      homepage: row.homepage ?? "",
      categories: parseJson<string[]>(row.categoriesJson, []),
      keywords: parseJson<string[]>(row.keywordsJson, []),
      screenshots: parseJson<Array<{ url: string; alt: string }>>(row.screenshotsJson, []),
      publisherMetadata: parseJson<PluginListingUpdate["publisherMetadata"]>(
        row.publisherMetadataJson,
        {},
      ),
    };
  }

  async updateOwnedPlugin(
    workosUserId: string,
    slug: string,
    input: PluginListingUpdate,
  ) {
    const users = await this.db
      .select({ id: hubUsers.id })
      .from(hubUsers)
      .where(eq(hubUsers.workosUserId, workosUserId))
      .limit(1);
    const userId = users[0]?.id;
    if (!userId) throw new PublisherStoreError("workos_user_not_synced");
    const rows = await this.db
      .update(plugins)
      .set({
        displayName: input.displayName,
        summary: input.summary,
        description: input.description,
        homepage: input.homepage || null,
        categoriesJson: JSON.stringify(input.categories),
        keywordsJson: JSON.stringify(input.keywords),
        screenshotsJson: JSON.stringify(input.screenshots),
        publisherMetadataJson: JSON.stringify(input.publisherMetadata),
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where(and(eq(plugins.slug, slug), eq(plugins.ownerUserId, userId)))
      .returning({ slug: plugins.slug });
    if (!rows[0]) throw new PublisherStoreError("plugin_not_owned");
    return { slug: rows[0].slug };
  }
}

export class PublisherStoreError extends Error {
  readonly code: "workos_user_not_synced" | "plugin_not_owned";

  constructor(code: PublisherStoreError["code"]) {
    super(code);
    this.name = "PublisherStoreError";
    this.code = code;
  }
}

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
