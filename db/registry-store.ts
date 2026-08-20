import type {
  HubProfile,
  HubProfileVersion,
  PluginRecord,
  PluginVersion,
  ProfileCatalogItem,
} from "@dsh-plugin-hub/schemas";
import {
  hubProfileSchema,
  hubProfileVersionSchema,
  pluginRecordSchema,
  pluginVersionSchema,
} from "@dsh-plugin-hub/schemas";
import type {
  PluginSummary,
  ProfileSummary,
  RegistryStore,
} from "@/lib/registry-service";
import { and, asc, desc, eq, gt, or, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "./schema.ts";
import {
  githubSourceListings,
  pluginVersions,
  plugins,
  profileVersions,
  profiles,
} from "./schema.ts";

// GitHub signal columns joined onto plugin queries; null when the repository
// has not been seen by topic discovery.
interface GithubSignalRow {
  githubStars: number | null;
  githubPushedAt: string | null;
}

export class D1RegistryStore implements RegistryStore {
  private readonly db: DrizzleD1Database<typeof schema>;

  constructor(db: DrizzleD1Database<typeof schema>) {
    this.db = db;
  }

  async search(input: {
    query: string;
    limit: number;
    cursor: string | null;
  }): Promise<{ items: PluginSummary[]; nextCursor: string | null }> {
    const pattern = `%${escapeLike(input.query)}%`;
    const searchCondition = input.query
      ? or(
          sql<boolean>`${plugins.packageName} LIKE ${pattern} ESCAPE '\\'`,
          sql<boolean>`${plugins.displayName} LIKE ${pattern} ESCAPE '\\'`,
          sql<boolean>`${plugins.summary} LIKE ${pattern} ESCAPE '\\'`,
          sql<boolean>`${plugins.keywordsJson} LIKE ${pattern} ESCAPE '\\'`,
        )
      : undefined;
    const cursorCondition = input.cursor
      ? gt(plugins.slug, input.cursor)
      : undefined;
    const where = searchCondition && cursorCondition
      ? and(searchCondition, cursorCondition)
      : searchCondition ?? cursorCondition;
    const query = this.db
      .select({
        plugin: plugins,
        githubStars: githubSourceListings.stars,
        githubPushedAt: githubSourceListings.pushedAt,
      })
      .from(plugins)
      .leftJoin(
        githubSourceListings,
        eq(plugins.repository, githubSourceListings.fullName),
      )
      .orderBy(asc(plugins.slug))
      .limit(input.limit + 1);
    const rows = where ? await query.where(where) : await query;
    const hasNext = rows.length > input.limit;
    const visible = rows.slice(0, input.limit);
    return {
      items: visible.map((row) =>
        toPluginSummary(row.plugin, {
          githubStars: row.githubStars,
          githubPushedAt: row.githubPushedAt,
        })),
      nextCursor: hasNext ? visible.at(-1)?.plugin.slug ?? null : null,
    };
  }

  // Offset-based paging with total count and sorting for the public catalog
  // page (numbered pagination). The cursor-based search() above stays for the
  // Registry API.
  async searchPage(input: {
    query: string;
    sort: "popular" | "updated" | "name";
    page: number;
    limit: number;
  }): Promise<{ items: PluginSummary[]; total: number }> {
    const pattern = `%${escapeLike(input.query)}%`;
    const where = input.query
      ? or(
          sql<boolean>`${plugins.packageName} LIKE ${pattern} ESCAPE '\\'`,
          sql<boolean>`${plugins.displayName} LIKE ${pattern} ESCAPE '\\'`,
          sql<boolean>`${plugins.summary} LIKE ${pattern} ESCAPE '\\'`,
          sql<boolean>`${plugins.keywordsJson} LIKE ${pattern} ESCAPE '\\'`,
        )
      : undefined;
    const limit = Math.min(Math.max(input.limit, 1), 100);
    const page = Math.max(input.page, 1);

    const countRows = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(plugins)
      .where(where);
    const total = Number(countRows[0]?.count ?? 0);

    const orderBy = input.sort === "updated"
      ? [desc(plugins.updatedAt), asc(plugins.slug)]
      : input.sort === "name"
        ? [asc(plugins.slug)]
        : [
            // popular: repositories seen by GitHub discovery first, by stars;
            // unseen packages keep slug order at the end.
            sql`${githubSourceListings.stars} DESC NULLS LAST`,
            asc(plugins.slug),
          ];

    const rows = await this.db
      .select({
        plugin: plugins,
        githubStars: githubSourceListings.stars,
        githubPushedAt: githubSourceListings.pushedAt,
      })
      .from(plugins)
      .leftJoin(
        githubSourceListings,
        eq(plugins.repository, githubSourceListings.fullName),
      )
      .where(where)
      .orderBy(...orderBy)
      .limit(limit)
      .offset((page - 1) * limit);

    return {
      items: rows.map((row) =>
        toPluginSummary(row.plugin, {
          githubStars: row.githubStars,
          githubPushedAt: row.githubPushedAt,
        })),
      total,
    };
  }

  async findPackage(packageName: string): Promise<PluginRecord | null> {
    return this.findPackageWhere(eq(plugins.packageName, packageName));
  }

  async findPackageBySlug(slug: string): Promise<PluginRecord | null> {
    return this.findPackageWhere(eq(plugins.slug, slug));
  }

  private async findPackageWhere(condition: ReturnType<typeof eq>): Promise<PluginRecord | null> {
    const rows = await this.db
      .select({
        plugin: plugins,
        githubStars: githubSourceListings.stars,
        githubPushedAt: githubSourceListings.pushedAt,
      })
      .from(plugins)
      .leftJoin(
        githubSourceListings,
        eq(plugins.repository, githubSourceListings.fullName),
      )
      .where(condition)
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    const plugin = row.plugin;
    const versions = await this.db
      .select()
      .from(pluginVersions)
      .where(eq(pluginVersions.pluginId, plugin.id))
      .orderBy(asc(pluginVersions.publishedAt));
    return pluginRecordSchema.parse({
      ...toPluginSummary(plugin, {
        githubStars: row.githubStars,
        githubPushedAt: row.githubPushedAt,
      }),
      versions: versions.map(toPluginVersion),
    });
  }

  async findProfile(slug: string): Promise<HubProfile | null> {
    const rows = await this.db
      .select()
      .from(profiles)
      .where(eq(profiles.slug, slug))
      .limit(1);
    const profile = rows[0];
    if (!profile) return null;
    const versions = await this.db
      .select()
      .from(profileVersions)
      .where(eq(profileVersions.profileId, profile.id))
      .orderBy(asc(profileVersions.publishedAt));
    return hubProfileSchema.parse({
      id: profile.id,
      slug: profile.slug,
      packageName: profile.packageName ?? undefined,
      repository: profile.repository ?? undefined,
      owner: profile.owner,
      claimed: Boolean(profile.ownerUserId),
      visibility: profile.visibility,
      latestVersion: profile.latestVersion,
      versions: versions.map(toProfileVersion),
      createdAt: asIso(profile.createdAt),
      updatedAt: asIso(profile.updatedAt),
    });
  }

  async listProfiles(limit: number): Promise<ProfileSummary[]> {
    const rows = await this.db
      .select()
      .from(profiles)
      .where(eq(profiles.visibility, "public"))
      .orderBy(asc(profiles.slug))
      .limit(Math.min(Math.max(limit, 1), 50));
    return rows.map((profile) => ({
      id: profile.id,
      slug: profile.slug,
      packageName: profile.packageName ?? undefined,
      repository: profile.repository ?? undefined,
      owner: profile.owner,
      claimed: Boolean(profile.ownerUserId),
      visibility: "public" as const,
      latestVersion: profile.latestVersion,
      createdAt: asIso(profile.createdAt),
      updatedAt: asIso(profile.updatedAt),
    }));
  }

  // Distinct publisher-declared categories with listing counts, most used
  // first. Powers category landing pages and the browse-by-category rail.
  async listCategories(limit = 24): Promise<Array<{ name: string; count: number }>> {
    const rows = await this.db.all<{ value: unknown; count: number }>(sql`
      SELECT value, COUNT(*) AS count
      FROM plugins, json_each(plugins.categories_json)
      GROUP BY value
      ORDER BY count DESC, value ASC
      LIMIT ${Math.min(Math.max(limit, 1), 100)}
    `);
    return rows
      .filter((row): row is { value: string; count: number } => typeof row.value === "string")
      .map((row) => ({ name: row.value, count: Number(row.count) }));
  }

  // Plugins carrying an exact category value (publisher-declared taxonomy),
  // GitHub signals attached like in search().
  async listByCategory(category: string, limit = 30): Promise<PluginSummary[]> {
    const rows = await this.db
      .select({
        plugin: plugins,
        githubStars: githubSourceListings.stars,
        githubPushedAt: githubSourceListings.pushedAt,
      })
      .from(plugins)
      .leftJoin(
        githubSourceListings,
        eq(plugins.repository, githubSourceListings.fullName),
      )
      .where(sql<boolean>`EXISTS (
        SELECT 1 FROM json_each(plugins.categories_json)
        WHERE json_each.value = ${category}
      )`)
      .orderBy(
        sql`${githubSourceListings.stars} DESC NULLS LAST`,
        asc(plugins.slug),
      )
      .limit(Math.min(Math.max(limit, 1), 100));
    return rows.map((row) =>
      toPluginSummary(row.plugin, {
        githubStars: row.githubStars,
        githubPushedAt: row.githubPushedAt,
      }));
  }

  async searchProfiles(query: string, limit: number): Promise<ProfileCatalogItem[]> {
    const pattern = `%${escapeLike(query)}%`;
    const searchCondition = query
      ? or(
          sql<boolean>`${profiles.slug} LIKE ${pattern} ESCAPE '\\'`,
          sql<boolean>`${profiles.owner} LIKE ${pattern} ESCAPE '\\'`,
          sql<boolean>`${profileVersions.manifestJson} LIKE ${pattern} ESCAPE '\\'`,
        )
      : undefined;
    const rows = await this.db
      .select({
        id: profiles.id,
        slug: profiles.slug,
        packageName: profiles.packageName,
        owner: profiles.owner,
        ownerUserId: profiles.ownerUserId,
        latestVersion: profiles.latestVersion,
        updatedAt: profiles.updatedAt,
        manifestJson: profileVersions.manifestJson,
      })
      .from(profiles)
      .innerJoin(
        profileVersions,
        and(
          eq(profileVersions.profileId, profiles.id),
          eq(profileVersions.version, profiles.latestVersion),
        ),
      )
      .where(
        searchCondition
          ? and(eq(profiles.visibility, "public"), searchCondition)
          : eq(profiles.visibility, "public"),
      )
      .orderBy(asc(profiles.slug))
      .limit(Math.min(Math.max(limit, 1), 50));

    return rows.map((row) => {
        const version = hubProfileVersionSchema.parse(
          parseJson(row.manifestJson, "profile manifest"),
        );
        return {
          id: row.id,
          slug: row.slug,
          packageName: row.packageName ?? undefined,
          owner: row.owner,
          claimed: Boolean(row.ownerUserId),
          latestVersion: row.latestVersion,
          name: version.name,
          description: version.description,
          bundleCount: version.bundles.length,
          updatedAt: asIso(row.updatedAt),
        };
      });
  }
}

function toPluginSummary(
  row: typeof plugins.$inferSelect,
  github?: GithubSignalRow,
): PluginSummary {
  const githubSignals = github && github.githubStars !== null
    ? {
      stars: github.githubStars,
      pushedAt: github.githubPushedAt ? asIso(github.githubPushedAt) : undefined,
    }
    : null;
  const record = {
    id: row.id,
    slug: row.slug,
    packageName: row.packageName,
    displayName: row.displayName,
    summary: row.summary,
    description: row.description,
    repository: row.repository,
    ...(githubSignals ? { github: githubSignals } : {}),
    homepage: row.homepage ?? undefined,
    license: row.license ?? undefined,
    categories: parseJson(row.categoriesJson, "plugin categories"),
    keywords: parseJson(row.keywordsJson, "plugin keywords"),
    iconUrl: row.iconUrl ?? undefined,
    screenshots: parseJson(row.screenshotsJson, "plugin screenshots"),
    publisherMetadata: parseJson(row.publisherMetadataJson, "publisher metadata"),
    claimed: Boolean(row.ownerUserId),
    verified: row.verified,
    deprecated: row.deprecated,
    replacement: row.replacement ?? undefined,
    latestVersion: row.latestVersion,
    distTags: parseJson(row.distTagsJson, "plugin dist-tags"),
    createdAt: asIso(row.createdAt),
    updatedAt: asIso(row.updatedAt),
  };
  return pluginRecordSchema.omit({ versions: true }).parse(record);
}

function toPluginVersion(row: typeof pluginVersions.$inferSelect): PluginVersion {
  return pluginVersionSchema.parse({
    version: row.version,
    channel: row.channel,
    manifest: parseJson(row.manifestJson, "plugin manifest"),
    source: parseJson(row.sourceJson, "plugin source"),
    compatibility: parseJson(row.compatibilityJson, "plugin compatibility"),
    entryIds: parseJson(row.entryIdsJson, "plugin entry ids"),
    before: parseJson(row.beforeJson, "plugin before rules"),
    after: parseJson(row.afterJson, "plugin after rules"),
    publishedAt: asIso(row.publishedAt),
    yanked: row.yanked,
    unpackedSize: row.unpackedSize ?? undefined,
    fileCount: row.fileCount ?? undefined,
  });
}

function toProfileVersion(row: typeof profileVersions.$inferSelect): HubProfileVersion {
  return hubProfileVersionSchema.parse(parseJson(row.manifestJson, "profile manifest"));
}

function parseJson(value: string, label: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    throw new Error(`Invalid ${label} JSON in D1`);
  }
}

function asIso(value: string): string {
  const normalized = value.includes("T") ? value : `${value.replace(" ", "T")}Z`;
  const date = new Date(normalized);
  if (Number.isNaN(date.valueOf())) throw new Error(`Invalid D1 timestamp: ${value}`);
  return date.toISOString();
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}
