# DeepSeek Harness Plugin Hub

An independent, unofficial community project for discovering and sharing
DeepSeek Harness plugins. The initial release is a coming-soon landing page
with a D1-backed email waitlist.

The waitlist includes unsubscribe and re-subscribe handling, bounded background
email retries, hashed D1 rate limiting, Cloudflare Turnstile
verification, source attribution, and a bilingual privacy notice.

## Prerequisites

- Node.js `>=22.13.0`

## Quick Start

```bash
npm install
npm run dev
npm run build
```

This starter does not use `wrangler.jsonc`.

## Project Shape

- `app/page.tsx` contains the bilingual landing page
- `app/api/waitlist/route.ts` accepts and deduplicates subscriptions
- `app/api/admin/waitlist/stats/route.ts` returns aggregate, non-PII interest metrics
- `db/schema.ts` defines the D1 waitlist table
- `.openai/hosting.json` declares the logical `DB` binding

## Independence Notice

This is an independent, unofficial community project. It is not affiliated
with, authorized by, or endorsed by DeepSeek.

## Waitlist Operations

Run the aggregate interest report against production:

```bash
npm run waitlist:stats
```

The report contains totals, active and unsubscribed counts, email delivery
status, language mix, top campaign sources, and the last 30 days of signups. It
does not return email addresses. The script reads the production domain and
server credential from the ignored local `.env` file.

Email delivery runs after the subscription has been durably stored. Transient
delivery failures receive up to three bounded attempts; the final state remains
available in the aggregate report.

Run the automated production health check with `npm run waitlist:health`. The
staging, backup, recovery, logging, and alert procedures are documented in
[`docs/operations/waitlist.md`](docs/operations/waitlist.md).

## Security Configuration

The D1-backed rate limit is always enabled in production. For Turnstile, create
a managed widget for `dshpluginhub.ai` and the Sites fallback hostname, then
configure both:

```dotenv
VITE_TURNSTILE_SITE_KEY=public-site-key
TURNSTILE_SECRET_KEY=server-secret-key
```

`VITE_TURNSTILE_SITE_KEY` is embedded during the build. Store
`TURNSTILE_SECRET_KEY`, `WAITLIST_RATE_LIMIT_SALT`, and
`WAITLIST_ADMIN_TOKEN` as hosted secrets. Production deliberately rejects new
subscriptions if either Turnstile or the rate-limit secret is missing, so a
partial security configuration cannot silently weaken protection.

The Worker adds a Content Security Policy, frame protection, MIME sniffing
protection, a restrictive Permissions Policy, and a referrer policy.

## Database Changes

After editing `db/schema.ts`:

```bash
npm run db:generate
npm run check
```

Inspect and commit the generated `drizzle/*.sql` migration. Sites packages and
applies committed migrations during publication. Use separate Sites projects
and D1 databases for staging and production once core Plugin Hub development
begins; do not test migrations against the production waitlist first.

## Workspace Auth Headers

Signed-in visitors receive both `oai-authenticated-user-id` and `oai-authenticated-user-email`. Private Sites require every visitor to sign in; public Sites may also have anonymous visitors, for whom neither header is present.

The user ID is stable for the same user on the same Site and different across Sites. Email and name are intended for display or contact purposes.

SIWC-authenticated workspace sites may also receive
`oai-authenticated-user-full-name` when the user's SIWC profile has a non-empty
`name` claim. The full-name value is percent-encoded UTF-8 and is accompanied by
`oai-authenticated-user-full-name-encoding: percent-encoded-utf-8`.

Treat the full name as optional and fall back to email when it is absent:

```tsx
import { headers } from "next/headers";

export default async function Home() {
  const requestHeaders = await headers();
  const userId = requestHeaders.get("oai-authenticated-user-id");
  const email = requestHeaders.get("oai-authenticated-user-email");
  const encodedFullName = requestHeaders.get("oai-authenticated-user-full-name");
  const fullName =
    encodedFullName &&
    requestHeaders.get("oai-authenticated-user-full-name-encoding") ===
      "percent-encoded-utf-8"
      ? decodeURIComponent(encodedFullName)
      : null;

  const displayName = fullName ?? email;
  // ...
}
```

## Optional Dispatch-Owned ChatGPT Sign-In

Import the ready-to-use helpers from `app/chatgpt-auth.ts` when the site needs
optional or required ChatGPT sign-in:

- Use `getChatGPTUser()` for optional signed-in UI.
- Use `requireChatGPTUser(returnTo)` for server-rendered pages that should send
  anonymous visitors through Sign in with ChatGPT.
- Use `chatGPTSignInPath(returnTo)` and `chatGPTSignOutPath(returnTo)` for
  browser links or actions.
- Pass a same-origin relative `returnTo` path for the destination after sign-in
  or sign-out. The helper validates and safely encodes it.
- Mark protected pages with `export const dynamic = "force-dynamic"` because
  they depend on per-request identity headers.

Dispatch owns `/signin-with-chatgpt`, `/signout-with-chatgpt`, `/callback`, the
OAuth cookies, and identity header injection. Do not implement app routes for
those reserved paths. Routes that do not import and call the helper remain
anonymous-compatible.

SIWC establishes identity only; it does not prove workspace membership. Use the
Sites hosting platform's access policy controls for workspace-wide restrictions,
or enforce explicit server-side membership or allowlist checks.

Use SIWC for account pages, user-specific dashboards, saved records, and write
actions tied to the current ChatGPT user. Leave public content anonymous.

## Useful Commands

- `npm run dev`: start local development
- `npm run build`: verify the vinext build output
- `npm test`: build and verify the rendered landing page
- `npm run check`: run lint, build, and all behavior tests
- `npm run db:generate`: generate Drizzle migrations after schema changes
- `npm run waitlist:stats`: display aggregate production waitlist interest

## Learn More

- [vinext Documentation](https://github.com/cloudflare/vinext)
- [Drizzle D1 Guide](https://orm.drizzle.team/docs/get-started/d1-new)
