import assert from "node:assert/strict";
import test from "node:test";

import {
  buildInsert,
  buildPluginUpdate,
  buildProfileUpdate,
  parseWranglerJson,
  sqlBool,
  sqlJsonb,
  sqlText,
  sqlTimestamp,
} from "../scripts/migrate-d1-to-pg.mjs";

const silent = () => {};

test("sqlText escapes single quotes and handles null", () => {
  assert.equal(sqlText("O'Brien"), "'O''Brien'");
  assert.equal(sqlText(null), "NULL");
  assert.equal(sqlText(undefined), "NULL");
  assert.equal(sqlText(42), "'42'");
});

test("sqlBool converts SQLite 0/1 to Postgres booleans", () => {
  assert.equal(sqlBool(1), "true");
  assert.equal(sqlBool(0), "false");
  assert.equal(sqlBool(null), "NULL");
  const warnings = [];
  assert.equal(sqlBool("yes", (m) => warnings.push(m)), "NULL");
  assert.equal(warnings.length, 1);
});

test("sqlTimestamp handles space-separated UTC and ISO8601", () => {
  assert.equal(
    sqlTimestamp("2026-08-01 10:20:30"),
    "'2026-08-01 10:20:30+00'::timestamptz",
  );
  assert.equal(
    sqlTimestamp("2026-08-01T10:20:30.000Z"),
    "'2026-08-01T10:20:30.000Z'::timestamptz",
  );
  assert.equal(sqlTimestamp(null), "NULL");
  const warnings = [];
  assert.equal(sqlTimestamp("not-a-date", (m) => warnings.push(m)), "NULL");
  assert.equal(warnings.length, 1);
});

test("sqlJsonb validates JSON and warns on invalid input", () => {
  assert.equal(sqlJsonb('["a","b"]'), `'["a","b"]'::jsonb`);
  assert.equal(sqlJsonb('{"key": "it\'s"}'), `'{"key":"it''s"}'::jsonb`);
  assert.equal(sqlJsonb(null), "NULL");
  const warnings = [];
  assert.equal(sqlJsonb("{broken", (m) => warnings.push(m)), "NULL");
  assert.equal(warnings.length, 1);
});

test("buildInsert emits ON CONFLICT DO NOTHING with typed columns", () => {
  const stmt = buildInsert(
    "github_installation_repositories",
    { id: "text", is_private: "bool", created_at: "ts" },
    { id: "r1", is_private: 1, created_at: "2026-01-02 03:04:05" },
    silent,
  );
  assert.equal(
    stmt,
    "INSERT INTO github_installation_repositories (id, is_private, created_at) VALUES ('r1', true, '2026-01-02 03:04:05+00'::timestamptz) ON CONFLICT DO NOTHING;",
  );
});

test("buildPluginUpdate matches by package_name and guards owner FK", () => {
  const stmt = buildPluginUpdate(
    {
      id: "d1-uuid",
      owner_user_id: "user-1",
      package_name: "@acme/tool",
      verified: 1,
      deprecated: 0,
      display_name: "It's a Tool",
      summary: "s",
      description: "d",
      homepage: null,
      license: "MIT",
      icon_url: null,
      categories_json: '["cli"]',
      keywords_json: "[]",
      screenshots_json: "[]",
      publisher_metadata_json: "{broken",
    },
    silent,
  );
  assert.match(stmt, /^UPDATE plugins SET /);
  assert.match(stmt, /WHERE package_name = '@acme\/tool';$/);
  assert.match(
    stmt,
    /owner_user_id = \(SELECT id FROM hub_users WHERE id = 'user-1'\)/,
  );
  assert.match(stmt, /verified = true/);
  assert.match(stmt, /deprecated = false/);
  assert.match(stmt, /display_name = 'It''s a Tool'/);
  assert.match(stmt, /homepage = NULL/);
  assert.match(stmt, /categories_json = '\["cli"\]'::jsonb/);
  // invalid publisher_metadata_json is skipped, keeping the NOT NULL column intact
  assert.doesNotMatch(stmt, /publisher_metadata_json/);
});

test("buildPluginUpdate omits owner when unclaimed", () => {
  const stmt = buildPluginUpdate(
    {
      owner_user_id: null,
      package_name: "p",
      verified: 0,
      deprecated: 0,
      categories_json: "[]",
      keywords_json: "[]",
      screenshots_json: "[]",
      publisher_metadata_json: "{}",
    },
    silent,
  );
  assert.doesNotMatch(stmt, /owner_user_id/);
});

test("buildProfileUpdate copies owner and visibility", () => {
  const stmt = buildProfileUpdate(
    { package_name: "@acme/profile", owner_user_id: "user-1", visibility: "private" },
    silent,
  );
  assert.match(stmt, /^UPDATE profiles SET /);
  assert.match(stmt, /visibility = 'private'/);
  assert.match(stmt, /WHERE package_name = '@acme\/profile';$/);
  assert.equal(buildProfileUpdate({ package_name: "p" }, silent), null);
});

test("parseWranglerJson reads [{results: [...]}] despite leading noise", () => {
  const fake = [
    {
      results: [
        { id: "u1", email: "a@b.c", verified: 0 },
        { id: "u2", email: "d@e.f", verified: 1 },
      ],
      success: true,
      meta: {},
    },
  ];
  const rows = parseWranglerJson(`some wrangler banner\n${JSON.stringify(fake)}`);
  assert.equal(rows.length, 2);
  assert.equal(rows[1].verified, 1);
  assert.throws(() => parseWranglerJson("no json here"), /no JSON array/);
});
