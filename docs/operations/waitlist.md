# Waitlist Operations Runbook

This runbook covers the public waitlist at `https://dshpluginhub.ai`. It keeps
the application, physical D1 database, DNS, Turnstile, and email service as
separate operational surfaces.

## Ownership boundary

| Surface | Current owner | Source of truth |
| --- | --- | --- |
| Application and D1 binding | OpenAI Sites project | `.openai/hosting.json` and saved Sites versions |
| Physical production D1 database | Sites-managed Cloudflare resource | Sites database inspection tools |
| Domain and Turnstile widget | Customer Cloudflare account | Cloudflare dashboard |
| Outbound email | Customer Cloudflare Email Service account | Cloudflare dashboard and aggregate waitlist stats |

The `DB` binding is real production state, but its physical database ID is not
exposed in this repository. Do not run Wrangler restore or export commands
against `CLOUDFLARE_D1_DATABASE_NAME` and assume they affect the Sites database.

## Routine checks

Run after every deployment and at least once per day:

```bash
npm run waitlist:health
npm run waitlist:stats
```

`waitlist:health` exits non-zero when the public route cannot reach D1, the
protected stats route fails, email failures from the last 24 hours reach
`WAITLIST_ALERT_MAX_FAILED_EMAILS` (default 5), or pending email count reaches
`WAITLIST_ALERT_MAX_PENDING_EMAILS` (default 10) after remaining pending for at
least 15 minutes. It prints aggregate values
only and never returns email addresses.

Alert recipient: `hello@dshpluginhub.ai`, configured through
`WAITLIST_ALERT_TO_EMAIL`. On a failed aggregate check, the script uses the
existing Cloudflare Email Service credentials to send a non-PII, best-effort
secondary alert before it exits non-zero. This email is not the primary channel:
the signup follow-up and this alert share a Cloudflare Email Service failure
domain.

Required scheduling:

- Probe `GET https://dshpluginhub.ai/api/health` every five minutes. Alert after
  two consecutive non-200 responses.
- Run `npm run waitlist:health` hourly from a persistent, secret-capable runner
  that has the local `.env`. Use the cron expression `0 * * * *`. The runner
  must independently notify the operator when the command exits non-zero or the
  scheduled run is missed; this runner notification is the primary alert path.
  Configure it before treating monitoring as operational. The script's email is
  only a secondary delivery attempt.
- Review `npm run waitlist:stats` weekly for signup and delivery trends.

## Logs

Use the Sites deployment status first to distinguish a failed publication from
a running application error. In persisted Workers Logs, filter for these event
names:

- `waitlist_security_not_configured`: required secret missing; new writes are
  intentionally disabled.
- `waitlist_request_failed`: D1 write or request processing failure.
- `waitlist_followup_background_failed`: background email workflow failure.
- `waitlist_stats_failed`: aggregate query failure.
- `waitlist_unsubscribe_failed`: unsubscribe write failure.
- `waitlist_health_failed`: health query could not reach D1.

Cloudflare documents the error filters `$metadata.error EXISTS` and
`$workers.outcome = "exception"` for Workers Logs. Real-time logs are useful
for an active incident but are sampled and are not a substitute for persisted
logs.

References:

- https://developers.cloudflare.com/workers/observability/logs/workers-logs/
- https://developers.cloudflare.com/workers/observability/errors/
- https://developers.cloudflare.com/workers/observability/logs/real-time-logs/

## Staging gate

Before catalog development or any schema change:

1. Create a separate private Sites project named `DeepSeek Plugin Hub Staging`,
   with hostname `staging.dshpluginhub.ai` and its own `DB` binding. Never point
   a staging deployment at the production D1 database.
2. Add `staging.dshpluginhub.ai` to a staging-only Turnstile widget. Use
   `hello@dshpluginhub.ai` as the only allowed email-test recipient until a
   separate staging sender is configured.
3. Apply every committed migration to a fresh staging database through a saved
   Sites version.
4. Run `pnpm check`, then verify `/` in both locale-cookie states, `/privacy`, `/api/health`, one
   Turnstile-protected signup, the welcome email, and unsubscribe.
5. Inspect aggregate stats and confirm that no production address or production
   token entered staging.
6. Promote the exact tested commit to production. Do not regenerate a migration
   between staging and production.

## Backup gate

Cloudflare D1 Time Travel is automatic on supported D1 production databases,
but restore access depends on control of the physical database. The current
Sites binding does not expose that database identifier to this repository.

Before any destructive or data-rewriting migration:

1. Record the production Sites version, commit, environment revision, aggregate
   row count, and current `/api/health` result.
2. Obtain a provider-confirmed restore point or export for the Sites-managed D1
   database. Database row inspection is verification, not a backup.
3. If a restorable point or export cannot be confirmed, stop. This is a hard
   release blocker, not an operator judgement call. Use an additive,
   forward-compatible migration instead of a destructive migration.
4. Retain the restore evidence with the release record, never in the Git
   repository if it contains subscriber data.

If the database later moves to a customer-owned Cloudflare D1 resource, use the
official commands below with the resolved production database name:

```bash
npx wrangler d1 time-travel info YOUR_DATABASE
npx wrangler d1 export YOUR_DATABASE --remote --output=./waitlist-backup.sql
```

Store exports encrypted, outside this repository, with access limited to the
operator. Cloudflare Time Travel supports point-in-time recovery; retention is
plan-dependent. See:

- https://developers.cloudflare.com/d1/reference/time-travel/
- https://developers.cloudflare.com/d1/best-practices/import-export-data/

## Recovery procedure

1. Declare an incident and pause migrations and deployments.
2. Capture the current Sites version, aggregate stats, health response, and
   relevant error logs. Do not copy subscriber addresses into tickets or chat.
3. If only application code is broken, deploy the last known-good saved Sites
   version and verify `/api/health` and the protected stats endpoint.
4. If data is wrong, stop writes before restoring. A code rollback does not
   reverse D1 migrations or data changes.
5. For Sites-managed D1, use the provider-confirmed restore point from the
   backup gate. For a customer-owned D1 database, obtain the target bookmark,
   have a second operator verify it, then run the destructive restore command.
6. Verify schema, active/unsubscribed totals, delivery totals, one controlled
   signup, and one controlled unsubscribe before reopening writes.
7. Preserve the pre-restore bookmark or export so the restore itself can be
   undone if necessary.

Targets: availability incident RTO 30 minutes; destructive-data incident RTO
four hours. RPO is the provider-confirmed D1 restore point. Without that
evidence, RPO is unknown and the destructive migration must not proceed.

## Alert response

- `/api/health` fails twice: severity 1; inspect deployment status and D1 logs,
  then roll back code if the failure began with a release.
- Security configuration missing: severity 1; restore the missing secret and
  redeploy the same validated version.
- Email failures or pending count reaches threshold: severity 2; inspect Email
  Service status and logs and preserve subscriptions. Do not replay a failed
  row until provider logs confirm the original message was not accepted.
- Stats endpoint alone fails: severity 2; verify the admin token revision and
  D1 aggregate query before changing subscriber data.
