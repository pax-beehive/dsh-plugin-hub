#!/usr/bin/env node
// One-shot data migration: Cloudflare D1 (SQLite) -> Cloud SQL Postgres.
//
// Only D1-exclusive data is migrated; plugins/plugin_versions/profiles/
// profile_versions were already re-discovered into Postgres by the npm sync
// pipeline, so for those tables we only UPDATE D1-exclusive fields matched by
// package_name (never INSERT, never touch ids). npm_sync_packages and
// npm_discovery_cursors are intentionally skipped (re-discovery is idempotent).
//
// Usage:
//   node scripts/migrate-d1-to-pg.mjs [--env staging] [--output migration-output.sql]
//   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f migration-output.sql
//
// Requires `npx wrangler login` beforehand. No third-party dependencies.

import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import process from "node:process";
import { pathToFileURL } from "node:url";

const D1_DATABASES = {
  production: "deepseek-plugin-hub-waitlist",
  staging: "deepseek-plugin-hub-staging",
};

// ---------------------------------------------------------------------------
// Value converters (exported for tests)
// ---------------------------------------------------------------------------

// SQL string literal with single-quote doubling; null/undefined -> NULL.
export function sqlText(value) {
  if (value === null || value === undefined) return "NULL";
  return `'${String(value).replaceAll("'", "''")}'`;
}

// SQLite stores booleans as 0/1 integers.
export function sqlBool(value, warn = console.warn) {
  if (value === null || value === undefined) return "NULL";
  if (value === 1 || value === true || value === "true") return "true";
  if (value === 0 || value === false || value === "false") return "false";
  warn(`unexpected boolean value ${JSON.stringify(value)}, storing NULL`);
  return "NULL";
}

// Two stored formats: "YYYY-MM-DD HH:MM:SS" (treated as UTC) and ISO8601.
export function sqlTimestamp(value, warn = console.warn) {
  if (value === null || value === undefined || value === "") return "NULL";
  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?$/.test(text)) {
    return `${sqlText(`${text}+00`)}::timestamptz`;
  }
  if (Number.isNaN(Date.parse(text))) {
    warn(`unparseable timestamp ${JSON.stringify(value)}, storing NULL`);
    return "NULL";
  }
  return `${sqlText(text)}::timestamptz`;
}

// *_json text columns -> jsonb literal after JSON.parse validation.
// Invalid JSON warns and returns "NULL".
export function sqlJsonb(value, warn = console.warn) {
  if (value === null || value === undefined) return "NULL";
  try {
    return `${sqlText(JSON.stringify(JSON.parse(String(value))))}::jsonb`;
  } catch {
    warn(`invalid JSON ${JSON.stringify(value)}, storing NULL`);
    return "NULL";
  }
}

const CONVERTERS = {
  text: sqlText,
  bool: sqlBool,
  ts: sqlTimestamp,
  jsonb: sqlJsonb,
  int: (value) => (value === null || value === undefined ? "NULL" : String(value)),
};

// ---------------------------------------------------------------------------
// Statement builders (exported for tests)
// ---------------------------------------------------------------------------

export function buildInsert(table, columns, row, warn = console.warn) {
  const names = Object.keys(columns);
  const values = names.map((name) =>
    CONVERTERS[columns[name]](row[name], warn),
  );
  return `INSERT INTO ${table} (${names.join(", ")}) VALUES (${values.join(", ")}) ON CONFLICT DO NOTHING;`;
}

// plugins: PG already has a row per package_name (fresh UUID); only copy the
// D1-exclusive claim/verified/deprecated/listing fields. owner_user_id is
// guarded so a skipped hub_user (email conflict) cannot abort on the FK.
export function buildPluginUpdate(row, warn = console.warn) {
  const sets = [];
  if (row.owner_user_id) {
    sets.push(
      `owner_user_id = (SELECT id FROM hub_users WHERE id = ${sqlText(row.owner_user_id)})`,
    );
  }
  sets.push(`verified = ${sqlBool(row.verified, warn)}`);
  sets.push(`deprecated = ${sqlBool(row.deprecated, warn)}`);
  for (const name of [
    "display_name",
    "summary",
    "description",
    "homepage",
    "license",
    "icon_url",
  ]) {
    sets.push(`${name} = ${sqlText(row[name])}`);
  }
  for (const name of [
    "categories_json",
    "keywords_json",
    "screenshots_json",
    "publisher_metadata_json",
  ]) {
    // These columns are NOT NULL in Postgres; skip instead of writing NULL
    // when the D1 text fails JSON.parse.
    const converted = sqlJsonb(row[name], warn);
    if (converted !== "NULL") sets.push(`${name} = ${converted}`);
  }
  return `UPDATE plugins SET ${sets.join(", ")} WHERE package_name = ${sqlText(row.package_name)};`;
}

// profiles: match by package_name, copy owner_user_id/visibility only.
export function buildProfileUpdate(row) {
  const sets = [];
  if (row.owner_user_id) {
    sets.push(
      `owner_user_id = (SELECT id FROM hub_users WHERE id = ${sqlText(row.owner_user_id)})`,
    );
  }
  if (row.visibility) {
    sets.push(`visibility = ${sqlText(row.visibility)}`);
  }
  if (sets.length === 0) return null;
  return `UPDATE profiles SET ${sets.join(", ")} WHERE package_name = ${sqlText(row.package_name)};`;
}

// wrangler d1 execute --json prints a JSON array like
// [{ results: [...rows], success: true, ... }]. Be defensive about any
// non-JSON noise wrangler may print before the payload.
export function parseWranglerJson(stdout) {
  const start = stdout.indexOf("[");
  if (start === -1) {
    throw new Error(`no JSON array in wrangler output: ${stdout.slice(0, 200)}`);
  }
  const parsed = JSON.parse(stdout.slice(start));
  if (!Array.isArray(parsed) || !parsed[0] || !Array.isArray(parsed[0].results)) {
    throw new Error("unexpected wrangler JSON shape (expected [{results: [...]}])");
  }
  return parsed[0].results;
}

// ---------------------------------------------------------------------------
// Migration plan
// ---------------------------------------------------------------------------

// Tables copied wholesale, in FK-safe order. Plain ON CONFLICT DO NOTHING
// skips rows colliding on the PK or any unique index (email, tokens, ...).
const INSERT_TABLES = [
  {
    name: "hub_users",
    columns: {
      id: "text",
      workos_user_id: "text",
      email: "text",
      display_name: "text",
      avatar_url: "text",
      created_at: "ts",
      updated_at: "ts",
    },
  },
  {
    name: "github_installations",
    columns: {
      id: "text",
      user_id: "text",
      account_login: "text",
      target_type: "text",
      repository_selection: "text",
      suspended_at: "ts",
      created_at: "ts",
      updated_at: "ts",
    },
  },
  {
    name: "github_installation_repositories",
    columns: {
      id: "text",
      installation_id: "text",
      repository_id: "text",
      full_name: "text",
      is_private: "bool",
      default_branch: "text",
      created_at: "ts",
      updated_at: "ts",
    },
  },
  {
    name: "waitlist_signups",
    columns: {
      id: "text",
      email: "text",
      locale: "text",
      source: "text",
      referrer: "text",
      utm_source: "text",
      utm_medium: "text",
      utm_campaign: "text",
      consent_version: "text",
      unsubscribe_token: "text",
      unsubscribed_at: "ts",
      resubscribed_at: "ts",
      followup_status: "text",
      followup_attempts: "int",
      followup_result: "text",
      followup_last_error: "text",
      followup_sent_at: "ts",
      created_at: "ts",
    },
  },
  {
    name: "waitlist_rate_limits",
    columns: { key: "text", attempts: "int", window_started_at: "int" },
  },
];

// ---------------------------------------------------------------------------
// Script generation + main
// ---------------------------------------------------------------------------

export function buildSqlScript(data, warn = console.warn) {
  const lines = ["BEGIN;", ""];
  for (const spec of INSERT_TABLES) {
    const rows = data[spec.name] ?? [];
    lines.push(`\\echo 'Migrating ${spec.name} (${rows.length} rows from D1)'`);
    for (const row of rows) {
      lines.push(buildInsert(spec.name, spec.columns, row, warn));
    }
    lines.push("");
  }
  const plugins = data.plugins ?? [];
  lines.push(`\\echo 'Updating plugins listing fields (${plugins.length} rows from D1)'`);
  for (const row of plugins) {
    if (!row.package_name) {
      warn(`plugins row ${row.id} has no package_name, skipped`);
      continue;
    }
    lines.push(buildPluginUpdate(row, warn));
  }
  lines.push("");
  const profiles = data.profiles ?? [];
  lines.push(`\\echo 'Updating profiles ownership (${profiles.length} rows from D1)'`);
  for (const row of profiles) {
    if (!row.package_name) {
      warn(`profiles row ${row.id} has no package_name, skipped`);
      continue;
    }
    const stmt = buildProfileUpdate(row);
    if (stmt) lines.push(stmt);
  }
  lines.push("", "COMMIT;", "");
  return lines.join("\n");
}

function parseArgs(argv) {
  const options = { env: "production", output: "migration-output.sql" };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--env") {
      options.env = argv[++index];
    } else if (argv[index] === "--output") {
      options.output = argv[++index];
    } else {
      console.error(`unknown argument: ${argv[index]}`);
      process.exit(1);
    }
  }
  if (!D1_DATABASES[options.env]) {
    console.error(`unknown env ${options.env} (expected: production|staging)`);
    process.exit(1);
  }
  return options;
}

function fetchRows(env, table) {
  const args = [
    "wrangler",
    "d1",
    "execute",
    D1_DATABASES[env],
    "--remote",
    "--json",
    "--command",
    `SELECT * FROM ${table}`,
  ];
  if (env !== "production") args.push("--env", env);
  const stdout = execFileSync("npx", args, {
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
  });
  return parseWranglerJson(stdout);
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const tables = [...INSERT_TABLES.map((spec) => spec.name), "plugins", "profiles"];
  const data = {};
  for (const table of tables) {
    console.log(`Exporting ${table} from D1 (${options.env})...`);
    data[table] = fetchRows(options.env, table);
    console.log(`  ${data[table].length} rows`);
  }
  const sql = buildSqlScript(data);
  writeFileSync(options.output, sql);
  console.log(`Wrote ${options.output}`);
  console.log(
    `Apply with: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f ${options.output}`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
