# npm sync operations

The npm sync pipeline has three entry points:

- Cron discovery every six hours at minute 17
- Public package-name submission from `/plugins`
- Signed-in immediate sync from `/dashboard`

Cron and public submissions publish `sync-package` messages to
`NPM_SYNC_QUEUE`. The queue consumer downloads the npm packument, validates all
versions, updates immutable registry records, reconciles dist-tags and marks
missing npm versions as withdrawn. Dashboard sync uses the same service inline.

## Staging resources

```text
Worker: deepseek-harness-plugin-hub-staging
D1: deepseek-plugin-hub-staging
Queue: dsh-plugin-hub-npm-sync-staging
Cron: 17 */6 * * *
Secret: NPM_SYNC_RATE_LIMIT_SALT
```

Apply migrations before deploying a Worker version that contains the queue
consumer:

```bash
pnpm db:migrate:staging
pnpm deploy:staging
```

The queue must exist before the first deploy:

```bash
wrangler queues create dsh-plugin-hub-npm-sync-staging
```

## State model

`npm_sync_packages` stores one row per candidate:

- `pending`: discovered and waiting for a consumer
- `syncing`: a consumer has started
- `accepted`: at least one valid DSH version entered the catalog
- `rejected`: package missing, too large, or without an admissible manifest
- `error`: transient registry or storage failure; scheduled with exponential backoff

Accepted packages are due again after one hour. Rejected packages are checked
again after one day. The six-hour Cron queues up to 100 due candidates per run
in addition to its fresh search results.

## Verification

After a staging deploy, submit a known npm package from `/plugins`, then inspect
the D1 state:

```sql
SELECT package_name, status, package_kind, last_error, last_synced_at,
       next_sync_at
FROM npm_sync_packages
ORDER BY updated_at DESC
LIMIT 20;
```

An accepted package must resolve through `/api/v1/packages/resolve` or appear in
the profile catalog. A keyword-only false positive must remain absent from both
public catalogs and have `status = 'rejected'`.

## Production TODO

Create an independent production Queue, apply the migrations to the production
D1 database, add production rate-limit secrets, and copy the queue/Cron bindings
only after staging observation is complete.
