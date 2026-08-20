import { sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const waitlistSignups = sqliteTable(
  "waitlist_signups",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    locale: text("locale").notNull().default("zh"),
    source: text("source").notNull().default("hero"),
    referrer: text("referrer"),
    utmSource: text("utm_source"),
    utmMedium: text("utm_medium"),
    utmCampaign: text("utm_campaign"),
    consentVersion: text("consent_version").notNull().default("2026-08-17"),
    unsubscribeToken: text("unsubscribe_token"),
    unsubscribedAt: text("unsubscribed_at"),
    resubscribedAt: text("resubscribed_at"),
    followupStatus: text("followup_status").notNull().default("not_sent"),
    followupAttempts: integer("followup_attempts").notNull().default(0),
    followupResult: text("followup_result"),
    followupLastError: text("followup_last_error"),
    followupSentAt: text("followup_sent_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("idx_waitlist_signups_email").on(table.email),
    uniqueIndex("idx_waitlist_signups_unsubscribe_token").on(
      table.unsubscribeToken,
    ),
  ],
);

export const waitlistRateLimits = sqliteTable("waitlist_rate_limits", {
  key: text("key").primaryKey(),
  attempts: integer("attempts").notNull().default(1),
  windowStartedAt: integer("window_started_at").notNull(),
});

export const hubUsers = sqliteTable(
  "hub_users",
  {
    id: text("id").primaryKey(),
    workosUserId: text("workos_user_id").notNull(),
    email: text("email").notNull(),
    displayName: text("display_name"),
    avatarUrl: text("avatar_url"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("idx_hub_users_workos_user_id").on(table.workosUserId),
    uniqueIndex("idx_hub_users_email").on(table.email),
  ],
);

export const githubInstallations = sqliteTable(
  "github_installations",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => hubUsers.id, { onDelete: "cascade" }),
    accountLogin: text("account_login").notNull(),
    targetType: text("target_type").notNull(),
    repositorySelection: text("repository_selection").notNull(),
    suspendedAt: text("suspended_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("idx_github_installations_user_id").on(table.userId)],
);

export const githubInstallationRepositories = sqliteTable(
  "github_installation_repositories",
  {
    id: text("id").primaryKey(),
    installationId: text("installation_id")
      .notNull()
      .references(() => githubInstallations.id, { onDelete: "cascade" }),
    repositoryId: text("repository_id").notNull(),
    fullName: text("full_name").notNull(),
    isPrivate: integer("is_private", { mode: "boolean" }).notNull(),
    defaultBranch: text("default_branch").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("idx_github_installation_repositories_unique").on(
      table.installationId,
      table.repositoryId,
    ),
    index("idx_github_installation_repositories_full_name").on(table.fullName),
  ],
);

export const plugins = sqliteTable(
  "plugins",
  {
    id: text("id").primaryKey(),
    ownerUserId: text("owner_user_id").references(() => hubUsers.id, {
      onDelete: "set null",
    }),
    slug: text("slug").notNull(),
    packageName: text("package_name").notNull(),
    displayName: text("display_name").notNull(),
    summary: text("summary").notNull(),
    description: text("description").notNull().default(""),
    repository: text("repository").notNull(),
    homepage: text("homepage"),
    license: text("license"),
    categoriesJson: text("categories_json").notNull().default("[]"),
    keywordsJson: text("keywords_json").notNull().default("[]"),
    iconUrl: text("icon_url"),
    screenshotsJson: text("screenshots_json").notNull().default("[]"),
    publisherMetadataJson: text("publisher_metadata_json").notNull().default("{}"),
    verified: integer("verified", { mode: "boolean" }).notNull().default(false),
    deprecated: integer("deprecated", { mode: "boolean" }).notNull().default(false),
    replacement: text("replacement"),
    latestVersion: text("latest_version").notNull(),
    distTagsJson: text("dist_tags_json").notNull().default("{}"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("idx_plugins_slug").on(table.slug),
    uniqueIndex("idx_plugins_package_name").on(table.packageName),
    index("idx_plugins_owner_user_id").on(table.ownerUserId),
    index("idx_plugins_updated_at").on(table.updatedAt),
  ],
);

export const pluginVersions = sqliteTable(
  "plugin_versions",
  {
    id: text("id").primaryKey(),
    pluginId: text("plugin_id")
      .notNull()
      .references(() => plugins.id, { onDelete: "cascade" }),
    version: text("version").notNull(),
    channel: text("channel").notNull().default("stable"),
    manifestJson: text("manifest_json").notNull(),
    sourceJson: text("source_json").notNull(),
    compatibilityJson: text("compatibility_json").notNull(),
    entryIdsJson: text("entry_ids_json").notNull().default("[]"),
    beforeJson: text("before_json").notNull().default("[]"),
    afterJson: text("after_json").notNull().default("[]"),
    publishedAt: text("published_at").notNull(),
    yanked: integer("yanked", { mode: "boolean" }).notNull().default(false),
    unpackedSize: integer("unpacked_size"),
    fileCount: integer("file_count"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("idx_plugin_versions_plugin_version").on(
      table.pluginId,
      table.version,
    ),
    index("idx_plugin_versions_published_at").on(table.publishedAt),
  ],
);

export const profiles = sqliteTable(
  "profiles",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    packageName: text("package_name"),
    repository: text("repository"),
    ownerUserId: text("owner_user_id").references(() => hubUsers.id, {
      onDelete: "set null",
    }),
    owner: text("owner").notNull(),
    visibility: text("visibility").notNull().default("public"),
    latestVersion: text("latest_version").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("idx_profiles_slug").on(table.slug),
    uniqueIndex("idx_profiles_package_name").on(table.packageName),
    index("idx_profiles_owner_user_id").on(table.ownerUserId),
  ],
);

export const profileVersions = sqliteTable(
  "profile_versions",
  {
    id: text("id").primaryKey(),
    profileId: text("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    version: text("version").notNull(),
    manifestJson: text("manifest_json").notNull(),
    publishedAt: text("published_at").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("idx_profile_versions_profile_version").on(
      table.profileId,
      table.version,
    ),
    index("idx_profile_versions_published_at").on(table.publishedAt),
  ],
);

export const npmSyncPackages = sqliteTable(
  "npm_sync_packages",
  {
    packageName: text("package_name").primaryKey(),
    discoverySource: text("discovery_source").notNull().default("manual"),
    status: text("status").notNull().default("pending"),
    packageKind: text("package_kind"),
    npmModifiedAt: text("npm_modified_at"),
    lastSyncedAt: text("last_synced_at"),
    nextSyncAt: text("next_sync_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    lastError: text("last_error"),
    consecutiveFailures: integer("consecutive_failures").notNull().default(0),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_npm_sync_packages_due").on(table.status, table.nextSyncAt),
    index("idx_npm_sync_packages_updated_at").on(table.updatedAt),
  ],
);

export const npmDiscoveryCursors = sqliteTable("npm_discovery_cursors", {
  query: text("query").primaryKey(),
  nextOffset: integer("next_offset").notNull().default(0),
  lastRunAt: text("last_run_at"),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

// GitHub topic discovery: public repositories carrying a DSH ecosystem topic.
// These are source-only candidates — installable only after the author
// publishes an npm package with a DSH manifest, at which point
// linked_package_name connects the listing to the registry record.
// Abuse / takedown reports submitted from the public report form.
// Rate limiting reuses waitlist_rate_limits with a "report:" key prefix.
export const abuseReports = sqliteTable(
  "abuse_reports",
  {
    id: text("id").primaryKey(),
    packageName: text("package_name"),
    reportedUrl: text("reported_url"),
    category: text("category").notNull(),
    description: text("description").notNull(),
    reporterEmail: text("reporter_email"),
    status: text("status").notNull().default("open"),
    resolutionNote: text("resolution_note"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_abuse_reports_status").on(table.status),
    index("idx_abuse_reports_package_name").on(table.packageName),
    index("idx_abuse_reports_created_at").on(table.createdAt),
  ],
);

export const githubSourceListings = sqliteTable(
  "github_source_listings",
  {
    fullName: text("full_name").primaryKey(),
    description: text("description").notNull().default(""),
    stars: integer("stars").notNull().default(0),
    language: text("language"),
    license: text("license"),
    topicsJson: text("topics_json").notNull().default("[]"),
    homepage: text("homepage"),
    pushedAt: text("pushed_at"),
    linkedPackageName: text("linked_package_name"),
    discoveryTopic: text("discovery_topic").notNull().default("dsh-plugin"),
    firstSeenAt: text("first_seen_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    lastSeenAt: text("last_seen_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_github_source_listings_stars").on(table.stars),
    index("idx_github_source_listings_linked").on(table.linkedPackageName),
  ],
);
