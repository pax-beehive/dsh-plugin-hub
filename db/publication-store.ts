import type {
  HubProfileVersion,
  PluginVersion,
} from "@dsh-plugin-hub/schemas";
import { isGreaterVersion } from "@dsh-plugin-hub/registry";
import { and, eq, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "./schema.ts";
import {
  hubUsers,
  pluginVersions,
  plugins,
  profileVersions,
  profiles,
} from "./schema.ts";

export interface PluginPublication {
  slug: string;
  packageName: string;
  displayName: string;
  summary: string;
  description: string;
  repository: string;
  homepage?: string;
  license?: string;
  categories: string[];
  keywords: string[];
  iconUrl?: string;
  screenshots: unknown[];
  version: PluginVersion;
}

export interface ProfilePublication {
  slug: string;
  packageName?: string;
  repository?: string;
  owner: string;
  version: HubProfileVersion;
}

export interface NpmPackageState {
  distTags: Record<string, string>;
  deprecated: boolean;
}

export class D1PublicationStore {
  private readonly db: DrizzleD1Database<typeof schema>;

  constructor(db: DrizzleD1Database<typeof schema>) {
    this.db = db;
  }

  async publishPlugin(workosUserId: string, input: PluginPublication) {
    const userId = await this.resolveUserId(workosUserId);
    return this.writePlugin(input, { ownerUserId: userId, claim: true });
  }

  async syncPlugin(input: PluginPublication, npmState: NpmPackageState) {
    return this.writePlugin(input, {
      ownerUserId: null,
      claim: false,
      npmState,
    });
  }

  async publishProfile(workosUserId: string, input: ProfilePublication) {
    const userId = await this.resolveUserId(workosUserId);
    return this.writeProfile(input, { ownerUserId: userId, claim: true });
  }

  async syncProfile(input: ProfilePublication) {
    return this.writeProfile(input, { ownerUserId: null, claim: false });
  }

  async reconcilePluginVersions(
    packageName: string,
    input: {
      presentVersions: string[];
      distTags: Record<string, string>;
      deprecated: boolean;
    },
  ) {
    const packageRows = await this.db
      .select()
      .from(plugins)
      .where(eq(plugins.packageName, packageName))
      .limit(1);
    const plugin = packageRows[0];
    if (!plugin) return;
    const rows = await this.db
      .select()
      .from(pluginVersions)
      .where(eq(pluginVersions.pluginId, plugin.id));
    const present = new Set(input.presentVersions);
    const available: string[] = [];
    for (const row of rows) {
      const source = parseSource(row.sourceJson);
      if (source.kind !== "npm" || source.packageName !== packageName) continue;
      const yanked = !present.has(row.version);
      if (!yanked) available.push(row.version);
      if (row.yanked !== yanked) {
        await this.db
          .update(pluginVersions)
          .set({ yanked })
          .where(eq(pluginVersions.id, row.id));
      }
    }
    const latestVersion = selectLatestVersion(available, input.distTags.latest)
      ?? plugin.latestVersion;
    await this.db
      .update(plugins)
      .set({
        latestVersion,
        distTagsJson: JSON.stringify(input.distTags),
        deprecated: input.deprecated,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where(eq(plugins.id, plugin.id));
  }

  async reconcileProfileVersions(
    packageName: string,
    input: { presentVersions: string[]; distTags: Record<string, string> },
  ) {
    const rows = await this.db
      .select()
      .from(profiles)
      .where(eq(profiles.packageName, packageName))
      .limit(1);
    const profile = rows[0];
    if (!profile) return;
    const versions = await this.db
      .select({ version: profileVersions.version })
      .from(profileVersions)
      .where(eq(profileVersions.profileId, profile.id));
    const present = new Set(input.presentVersions);
    const available = versions
      .map((row) => row.version)
      .filter((version) => present.has(version));
    const latestVersion = selectLatestVersion(available, input.distTags.latest)
      ?? profile.latestVersion;
    await this.db
      .update(profiles)
      .set({ latestVersion, updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(eq(profiles.id, profile.id));
  }

  private async writePlugin(
    input: PluginPublication,
    options: {
      ownerUserId: string | null;
      claim: boolean;
      npmState?: NpmPackageState;
    },
  ) {
    const packageRows = await this.db
      .select()
      .from(plugins)
      .where(eq(plugins.packageName, input.packageName))
      .limit(1);
    const slugRows = await this.db
      .select()
      .from(plugins)
      .where(eq(plugins.slug, input.slug))
      .limit(1);
    const current = packageRows[0];
    if (slugRows[0] && slugRows[0].packageName !== input.packageName) {
      throw new PublicationStoreError("slug_taken");
    }
    if (options.claim && current?.ownerUserId && current.ownerUserId !== options.ownerUserId) {
      throw new PublicationStoreError("package_owned_by_another_publisher");
    }
    if (
      current?.ownerUserId &&
      current.repository.toLowerCase() !== input.repository.toLowerCase()
    ) {
      throw new PublicationStoreError(
        options.claim
          ? "package_owned_by_another_publisher"
          : "repository_changed_after_claim",
      );
    }

    const pluginId = current?.id ?? crypto.randomUUID();
    const serialized = serializePluginVersion(input.version);
    const versionRows = current
      ? await this.db
          .select()
          .from(pluginVersions)
          .where(
            and(
              eq(pluginVersions.pluginId, pluginId),
              eq(pluginVersions.version, input.version.version),
            ),
          )
          .limit(1)
      : [];
    if (
      versionRows[0] &&
      (versionRows[0].manifestJson !== serialized.manifestJson ||
        versionRows[0].sourceJson !== serialized.sourceJson ||
        versionRows[0].compatibilityJson !== serialized.compatibilityJson)
    ) {
      throw new PublicationStoreError("version_is_immutable");
    }

    const distTags = options.npmState?.distTags ?? { latest: input.version.version };
    if (!current) {
      await this.db.insert(plugins).values({
        id: pluginId,
        ownerUserId: options.ownerUserId,
        slug: input.slug,
        packageName: input.packageName,
        displayName: input.displayName,
        summary: input.summary,
        description: input.description,
        repository: input.repository,
        homepage: input.homepage,
        license: input.license,
        categoriesJson: JSON.stringify(input.categories),
        keywordsJson: JSON.stringify(input.keywords),
        iconUrl: input.iconUrl,
        screenshotsJson: JSON.stringify(input.screenshots),
        deprecated: options.npmState?.deprecated ?? false,
        latestVersion: input.version.version,
        distTagsJson: JSON.stringify(distTags),
      });
    } else {
      const listing = options.claim || !current.ownerUserId
        ? {
            ownerUserId: options.claim ? options.ownerUserId : current.ownerUserId,
            displayName: input.displayName,
            summary: input.summary,
            description: input.description,
            repository: input.repository,
            homepage: input.homepage,
            license: input.license,
            categoriesJson: JSON.stringify(input.categories),
            keywordsJson: JSON.stringify(input.keywords),
            iconUrl: input.iconUrl,
            screenshotsJson: JSON.stringify(input.screenshots),
          }
        : {};
      await this.db
        .update(plugins)
        .set({
          ...listing,
          deprecated: options.npmState?.deprecated ?? current.deprecated,
          distTagsJson: JSON.stringify(distTags),
          updatedAt: sql`CURRENT_TIMESTAMP`,
        })
        .where(eq(plugins.id, pluginId));
    }

    if (!versionRows[0]) {
      await this.db.insert(pluginVersions).values({
        id: crypto.randomUUID(),
        pluginId,
        version: input.version.version,
        channel: input.version.channel,
        ...serialized,
        entryIdsJson: JSON.stringify(input.version.entryIds),
        beforeJson: JSON.stringify(input.version.before),
        afterJson: JSON.stringify(input.version.after),
        publishedAt: input.version.publishedAt,
        yanked: input.version.yanked,
        unpackedSize: input.version.unpackedSize,
        fileCount: input.version.fileCount,
      });
    }

    if (!current || isGreaterVersion(input.version.version, current.latestVersion)) {
      await this.db
        .update(plugins)
        .set({
          latestVersion: input.version.version,
          updatedAt: sql`CURRENT_TIMESTAMP`,
        })
        .where(eq(plugins.id, pluginId));
    }
    return {
      kind: "plugin" as const,
      slug: input.slug,
      version: input.version.version,
      created: !versionRows[0],
    };
  }

  private async writeProfile(
    input: ProfilePublication,
    options: { ownerUserId: string | null; claim: boolean },
  ) {
    const rows = input.packageName
      ? await this.db
          .select()
          .from(profiles)
          .where(eq(profiles.packageName, input.packageName))
          .limit(1)
      : await this.db
          .select()
          .from(profiles)
          .where(eq(profiles.slug, input.slug))
          .limit(1);
    const current = rows[0];
    if (current && current.slug !== input.slug) {
      throw new PublicationStoreError("slug_taken");
    }
    if (options.claim && current?.ownerUserId && current.ownerUserId !== options.ownerUserId) {
      throw new PublicationStoreError("profile_owned_by_another_publisher");
    }
    if (
      current?.ownerUserId &&
      current.repository &&
      input.repository &&
      current.repository.toLowerCase() !== input.repository.toLowerCase()
    ) {
      throw new PublicationStoreError("repository_changed_after_claim");
    }
    const profileId = current?.id ?? crypto.randomUUID();
    if (!current) {
      await this.db.insert(profiles).values({
        id: profileId,
        slug: input.slug,
        packageName: input.packageName,
        repository: input.repository,
        ownerUserId: options.ownerUserId,
        owner: input.owner,
        visibility: "public",
        latestVersion: input.version.version,
      });
    } else if (options.claim || !current.ownerUserId) {
      await this.db
        .update(profiles)
        .set({
          packageName: input.packageName ?? current.packageName,
          repository: input.repository ?? current.repository,
          ownerUserId: options.claim ? options.ownerUserId : current.ownerUserId,
          owner: input.owner,
          updatedAt: sql`CURRENT_TIMESTAMP`,
        })
        .where(eq(profiles.id, profileId));
    }
    const versionRows = await this.db
      .select()
      .from(profileVersions)
      .where(
        and(
          eq(profileVersions.profileId, profileId),
          eq(profileVersions.version, input.version.version),
        ),
      )
      .limit(1);
    const manifestJson = JSON.stringify(input.version);
    if (versionRows[0]) {
      if (versionRows[0].manifestJson !== manifestJson) {
        throw new PublicationStoreError("version_is_immutable");
      }
      return {
        kind: "profile" as const,
        slug: input.slug,
        version: input.version.version,
        created: false,
      };
    }
    await this.db.insert(profileVersions).values({
      id: crypto.randomUUID(),
      profileId,
      version: input.version.version,
      manifestJson,
      publishedAt: input.version.publishedAt,
    });
    if (!current || isGreaterVersion(input.version.version, current.latestVersion)) {
      await this.db
        .update(profiles)
        .set({ latestVersion: input.version.version, updatedAt: sql`CURRENT_TIMESTAMP` })
        .where(eq(profiles.id, profileId));
    }
    return {
      kind: "profile" as const,
      slug: input.slug,
      version: input.version.version,
      created: true,
    };
  }

  private async resolveUserId(workosUserId: string) {
    const rows = await this.db
      .select({ id: hubUsers.id })
      .from(hubUsers)
      .where(eq(hubUsers.workosUserId, workosUserId))
      .limit(1);
    if (!rows[0]) throw new PublicationStoreError("workos_user_not_synced");
    return rows[0].id;
  }
}

export class PublicationStoreError extends Error {
  readonly code:
    | "slug_taken"
    | "package_owned_by_another_publisher"
    | "profile_owned_by_another_publisher"
    | "repository_changed_after_claim"
    | "version_is_immutable"
    | "workos_user_not_synced";

  constructor(code: PublicationStoreError["code"]) {
    super(code);
    this.name = "PublicationStoreError";
    this.code = code;
  }
}

function serializePluginVersion(version: PluginVersion) {
  return {
    manifestJson: JSON.stringify(version.manifest),
    sourceJson: JSON.stringify(version.source),
    compatibilityJson: JSON.stringify(version.compatibility),
  };
}

function parseSource(value: string): { kind: string; packageName?: string } {
  try {
    const source = JSON.parse(value) as { kind?: unknown; packageName?: unknown };
    return {
      kind: typeof source.kind === "string" ? source.kind : "unknown",
      packageName: typeof source.packageName === "string" ? source.packageName : undefined,
    };
  } catch {
    return { kind: "unknown" };
  }
}

function selectLatestVersion(versions: string[], preferred?: string): string | null {
  if (preferred && versions.includes(preferred)) return preferred;
  let latest: string | null = null;
  for (const version of versions) {
    if (!latest || isGreaterVersion(version, latest)) latest = version;
  }
  return latest;
}
