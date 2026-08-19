# Migration Plan: Plugin Scanning & Storage → GCP (Cloud Run + Cloud SQL)

Status: **proposal** — pending review before implementation.

Scope: move the plugin scanning/synchronization pipeline and the plugin data store from
Cloudflare (Queues + Cron + D1) to GCP (Cloud Run + Cloud SQL for Postgres + Cloud Tasks /
Scheduler). The Next.js site itself is **not** in scope for the first phase (see §7).

## 1. Current State Summary

### 1.1 Scanning / sync pipeline

Four entry points converge on two core functions in `lib/npm-sync.ts`:

| Entry | Location | Mechanism |
|---|---|---|
| Cron discovery (every 6h) | `worker/index.ts:59` `scheduled()` | `scheduleNpmSync()` (`lib/npm-sync.ts:152`) searches npm registry with 3 keyword queries, persists pagination cursors in `npm_discovery_cursors`, enqueues candidates to Cloudflare Queue in batches of 100 |
| Public submit | `app/api/v1/packages/submit/route.ts` | Same-origin + zod validation, IP rate limit (reuses `waitlist_rate_limits`), `recordCandidate()`, `NPM_SYNC_QUEUE.send()`, returns 202 |
| Queue consumer | `worker/index.ts:75` `queue()` | `syncNpmPackage()` per message; `ack()` on success, `message.retry({delaySeconds:60})` for retryable `NpmSyncError` (max_retries=3) |
| Manual sync (authed) | `app/api/v1/manage/sync/npm/route.ts` | WorkOS `withAuth`, calls `syncNpmPackage()` inline, no queue |

Core sync flow (`syncNpmPackage()`, `lib/npm-sync.ts:43`):

1. `recordCandidate()` → `markSyncing()`
2. `fetchPackument()`: GET `https://registry.npmjs.org/{name}`, 8MB cap, name-match validation
3. Per version: `parseNpmVersion()` (`lib/npm-package-parser.ts:20`) — plugin manifest or profile manifest, GitHub repository required for plugins, tarball URL must be on registry.npmjs.org, kind must not change within a package
4. Valid versions → `publicationStore.syncPlugin()/syncProfile()` (immutable-version upsert)
5. `reconcilePluginVersions()`: mark versions gone from npm as `yanked`, update `latestVersion` / `distTags` / `deprecated`
6. Reschedule: accepted → +1h, rejected → +24h, failed → exponential backoff `min(2^n*5, 360)` min, capped at 8 failures

Separate immediate-publish path (bypasses the scan state machine):
`app/api/v1/manage/publish/npm/route.ts` → `lib/npm-publication.ts` `publishNpmPackage()`.

### 1.2 Storage layer

- Drizzle ORM 0.45.2 with `drizzle-orm/d1` driver; `getDb()` in `db/index.ts:5-13` reads
  `env.DB` from `cloudflare:workers`. `worker/index.ts:68,79` creates its own `drizzle(env.DB)` instances.
- 9 tables (`db/schema.ts`):
  - Plugin data: `plugins`, `plugin_versions`, `profiles`, `profile_versions`
  - Identity/GitHub: `hub_users`, `github_installations`, `github_installation_repositories`
  - Sync state: `npm_sync_packages`, `npm_discovery_cursors`
  - Waitlist (separable): `waitlist_signups`, `waitlist_rate_limits`
- 6 store modules: `registry-store` (read/search), `publication-store` (writes/upsert),
  `publisher-store` (listing self-service), `npm-sync-store` (state machine),
  `identity-store`, `waitlist-store`
- Access pattern: read-heavy (LIKE search + cursor pagination on `plugins`, detail = 1+N queries);
  writes concentrated in the background sync worker. No transactions used today.
- 12 JSON columns stored as `text` with application-level `JSON.parse/stringify`.
- Mixed timestamp formats: `CURRENT_TIMESTAMP` (`"YYYY-MM-DD HH:MM:SS"`) vs ISO 8601 from
  `npm-sync-store`; normalized at read time by `asIso()` (`registry-store.ts:254`).
- Migrations: `drizzle/0000–0007` are SQLite DDL, applied via `wrangler d1 migrations apply`.
- Tests: 9 integration tests run against Miniflare local D1 (`tests/fixtures/wrangler.integration.jsonc`).

### 1.3 Cloudflare-specific coupling inventory

| Dependency | Locations | Migration impact |
|---|---|---|
| `cloudflare:workers` module (`env`, `waitUntil`) | `db/index.ts`, `app/api/v1/packages/submit/route.ts`, `app/api/waitlist/route.ts`, `app/api/v1/manage/publish/github/route.ts`, +2 | Highest-impact coupling; no Node equivalent |
| D1 binding + `drizzle-orm/d1` | `db/index.ts`, `worker/index.ts:68,79`, all 6 stores, `lib/waitlist-*.ts` | Driver + dialect change |
| Cloudflare Queues (producer `send/sendBatch`, consumer `MessageBatch`, `ack/retry`) | `worker/index.ts:75-108`, `lib/npm-sync.ts:154`, submit route | Replace with Cloud Tasks / Pub/Sub |
| Cron Triggers `scheduled()` | `worker/index.ts:59` | Replace with Cloud Scheduler |
| `ExecutionContext.waitUntil` | `worker/index.ts:69`, `app/api/waitlist/route.ts:49` | Drop; `await` directly on Cloud Run |
| `cf-connecting-ip` header | submit route `:33` | Use `X-Forwarded-For` |
| Workers Assets / Images bindings | `worker/index.ts:44-53` | Out of scope (site stays on CF in phase 1) |

**Note:** queues/crons are currently only configured for the staging env in `wrangler.jsonc`;
production has not enabled them yet (`docs/npm-sync.md` "Production TODO"). This migration is a
good opportunity to land the production pipeline on GCP directly.

### 1.4 What does NOT need to change

- `packages/schemas` (shared zod schemas) and the CLI — the CLI only does local validation plus
  read-only Hub API calls. Zero changes as long as API response shapes stay stable.
- Core sync logic `lib/npm-sync.ts`, `lib/npm-package-parser.ts`, `lib/npm-publication.ts` —
  they only use standard Web APIs (`fetch`, `AbortSignal.timeout`, `crypto.subtle`, zod), all
  supported on Node 20+.
- The sync state machine design in `docs/npm-sync.md` — pure SQL, backend-agnostic.
- GitHub publication path (unless migrated later).

## 2. Target Architecture (Phase 1)

```
                        ┌─────────────────────────────┐
   npm registry API ──▶ │  Cloud Run: sync-worker      │
                        │  - POST /tasks/sync-package  │ ◀── Cloud Tasks (push, retry config)
                        │  - POST /internal/schedule   │ ◀── Cloud Scheduler (every 6h, OIDC auth)
                        │  - POST /packages/submit     │ ◀── (optional, if submit moves too)
                        └──────────────┬──────────────┘
                                       │ Drizzle (node-postgres)
                                       ▼
                        ┌─────────────────────────────┐
                        │  Cloud SQL for PostgreSQL    │
                        └──────────────▲──────────────┘
                                       │
   Cloudflare (unchanged): Next.js ────┘ read path options below (§7)
```

Components:

- **Cloud Run service `sync-worker`**: hosts the queue-consumer endpoint (Cloud Tasks HTTP push),
  the scheduler endpoint, and optionally the public submit endpoint. Reuses `lib/npm-sync.ts`,
  `lib/npm-package-parser.ts`, and the store modules with a Postgres driver.
- **Cloud Tasks queue `npm-sync`**: replaces Cloudflare Queues. Maps cleanly:
  `sendBatch(100)` → batched `createTask`; `message.retry({delaySeconds:60})` → task retry config
  with backoff; `max_retries:3` → `maxAttempts`. Message shape `NpmSyncQueueMessage` can be kept verbatim.
- **Cloud Scheduler job**: `17 */6 * * *` (keep existing cadence) → POST `/internal/schedule`
  with an OIDC token, replacing the worker-only trust boundary of Cron Triggers.
- **Cloud SQL for PostgreSQL**: single instance; Drizzle via `drizzle-orm/node-postgres`
  (or `postgres-js`). Connect from Cloud Run via the Cloud SQL connector / private IP.

## 3. Work Items

### 3.1 Database layer (largest chunk)

1. Convert `db/schema.ts`: `sqliteTable` → `pgTable`; `integer({mode:"boolean"})` → `boolean`;
   text timestamps → `timestamp({ withTimezone: true })`; the 12 `*_json` text columns → `jsonb`.
2. Change all `DrizzleD1Database` type annotations (6 stores + `lib/waitlist-*.ts`, 3 files) to `PgDatabase`.
3. Replace `getDb()` with a Node Postgres pool; remove all `cloudflare:workers` imports
   (6 files) in favor of `process.env` config.
4. Fix SQLite-only SQL in `lib/waitlist-admin.ts:46-47,69-71`
   (`datetime('now', '-30 days')` etc.) → `now() - interval '30 days'`, `date_trunc`.
5. `LIKE` → `ILIKE` in `registry-store.ts:38-43,144-148` (SQLite LIKE is ASCII case-insensitive,
   Postgres LIKE is not). `keywords_json` / `manifest_json` LIKE queries must be rewritten for
   jsonb (`->>` / `@>`). Add `pg_trgm` GIN index if search latency regresses.
6. Regenerate migrations with `drizzle-kit generate` for the `postgresql` dialect; the existing
   `drizzle/0000–0007` SQLite DDL cannot be replayed. Keep the old folder for reference or move it aside.
7. While rebuilding the schema, also fix the 0004 quirk: `plugins.owner_user_id` FK in the old
   migration lacks `ON DELETE SET NULL` (schema.ts declares it) — the PG schema gets it right for free.
8. No changes needed for `.returning()` / `.onConflictDoUpdate()` call sites — Drizzle generates
   correct PG syntax for both.

### 3.2 Data migration (one-shot)

Script: D1 export (via `wrangler d1 export` or API) → transform → load into Postgres.

Watch out for:

- Boolean columns stored as 0/1 integers (`verified`, `deprecated`, `yanked`, `is_private`).
- Two timestamp formats in the same columns (normalize with the same rules as `asIso()`).
- JSON text columns → validate + cast to jsonb.
- Sequence/id strategy: PKs are app-generated UUID strings, so no sequence conflicts.
- Verify slug cursor pagination behavior (`slug > cursor`) under the PG default collation with
  scoped npm names (`@scope/pkg`) — expected to be fine, regression-test it.

### 3.3 Queue + cron replacement

1. Define the Cloud Tasks queue with retry policy equivalent to today
   (`maxAttempts: 4`, `minBackoff: 60s`, exponential).
2. Implement the consumer endpoint: POST `/tasks/sync-package` → `syncNpmPackage()` →
   2xx to ack, 429/5xx to trigger retry. Keep `NpmSyncError.retryable` semantics by mapping to
   status codes.
3. Implement `POST /internal/schedule` → `scheduleNpmSync()` (adapted to enqueue Cloud Tasks
   instead of `queue.sendBatch`). The schedule phase is fast; request timeout is not a concern.
4. Secure both endpoints with OIDC token verification (Cloud Tasks / Scheduler service accounts).
   This replaces the implicit "only the worker can call this" trust boundary.
5. Update `app/api/v1/packages/submit/route.ts`: replace `NPM_SYNC_QUEUE.send()` with a Cloud
   Tasks client call (or move the submit endpoint to Cloud Run entirely — recommended, since it
   also needs DB access for the rate limit).

### 3.4 Config / secrets

Move `NPM_SYNC_RATE_LIMIT_SALT`, `WORKOS_*`, `GITHUB_*`, DB connection string to GCP Secret
Manager, injected into Cloud Run as env vars.

### 3.5 Tests

- Replace the Miniflare D1 fixture (`tests/fixtures/wrangler.integration.jsonc`) with a local
  Postgres (docker compose for dev, testcontainers in CI). 9 integration tests need their
  `drizzle(binding)` bootstrap swapped — test bodies should mostly survive since they go through
  the store layer.
- Update CI (`.github/workflows/ci.yml`) to provision a Postgres service container.
- Add a regression test for the ILIKE search behavior and jsonb queries.

## 4. Suggested Phasing

1. **Phase 0 — prep**: pgTable schema + store refactor done dialect-agnostically (store code
   should compile against both drivers where feasible); CI Postgres; unit tests green.
2. **Phase 1 — GCP pipeline**: Cloud Run sync-worker + Cloud Tasks + Scheduler + Cloud SQL,
   fed by data-migration script. Submit endpoint moved to Cloud Run. Site read path: see §7.
3. **Phase 2 — cutover**: point read traffic at Postgres (per §7 decision), decommission D1
   sync state, keep Cloudflare Queues/Cron config removed from wrangler.
4. **Phase 3 (optional)**: full site migration to Cloud Run (out of scope here).

## 5. Effort Estimate (rough)

| Area | Size |
|---|---|
| Schema + stores dialect conversion | M |
| Data migration script + validation | S–M |
| Cloud Tasks/Scheduler/Cloud Run service | M |
| Submit endpoint move + rate limit | S |
| Test infra (Postgres fixtures, CI) | M |
| Docs (update `docs/npm-sync.md`, handover, AGENTS) | S |

## 6. Risks / Open Questions

- **Search quality**: LIKE→ILIKE without trigram indexing will full-scan `plugins`; acceptable at
  current scale, plan `pg_trgm` before the table grows large.
- **Cross-cloud latency (phase 1)**: if the site stays on Cloudflare while data moves to Cloud SQL,
  every page read crosses clouds. Options in §7.
- **Timestamp normalization**: one-shot migration must handle both stored formats; add row-count
  and spot-check validation steps.
- **The `npm_discovery_cursors` / `npm_sync_packages` state** can either be migrated or simply
  re-discovered (discovery is idempotent via `recordCandidate` upsert) — re-discovery is simpler
  and low-risk.

## 7. Decision Needed: Read Path in Phase 1

If only scanning + storage move to GCP while the Next.js site stays on Cloudflare Workers,
the site's read path (`registry-store` queries from pages and `/api/v1/packages/*`) needs a
strategy:

- **Option A — Hyperdrive**: Cloudflare Hyperdrive pools connections to Cloud SQL; minimal code
  change (swap driver), per-query cross-cloud latency, Hyperdrive query caching helps hot reads.
- **Option B — Read API on Cloud Run**: site calls a thin HTTP API on Cloud Run instead of direct
  DB. Cleaner trust boundary, but adds a hop and re-plumbs all store call sites.
- **Option C — Migrate the site too**: fold everything into Cloud Run in one go. Simplest end
  state, biggest single-step blast radius.

Recommendation: **Option A** for phase 1 (smallest diff), revisit Option C later if desired.
