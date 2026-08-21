# DSH Plugin Hub

Community registry, publisher console, and CLI for versioned DeepSeek Harness
plugins and profiles. The project is independent and unofficial.

## What is implemented

- Public plugin search, detail pages, screenshots, compatibility and exact install specs
- Editable Profile Drafts and immutable, content-addressed Profile Releases
- JSON Registry API for packages, versions and profiles
- `dsh-hub` CLI for capture, share, exact apply, portable import and rollback
- DSH plugin tools and an agent Skill for confirmed plan/apply automation
- WorkOS AuthKit publisher accounts
- Automatic npm discovery, manifest validation and version-history sync
- Public one-time package submission and signed-in immediate sync
- Optional GitHub App repository claim and listing management
- Immutable published versions; listing copy may be refreshed independently
- Vinext SSR/RSC web shell on Cloudflare Workers
- Locale-aware public HTML and Hub API edge caching
- Same-origin cached Gravatar plugin icons
- Go Hub backend on Cloud Run with PostgreSQL persistence

## Workspace

```text
app/                 vinext / Next.js routes and publisher UI
components/          shared server and client UI modules
lib/                 Hub adapters, auth, i18n, SEO and edge policy
packages/schemas/    shared Zod wire and manifest schemas
packages/registry/   version and profile-order resolution
packages/cli/        dsh-hub command-line client
examples/             copyable, schema-tested starter bundles
```

The web shell stays on vinext so it deploys as a Cloudflare Worker. Portable
registry logic lives in workspace packages and has no Cloudflare dependency.
See [`docs/adr/0001-retain-vinext-cloudflare-worker.md`](docs/adr/0001-retain-vinext-cloudflare-worker.md).
The current runtime map and ownership rules live in
[`docs/architecture.md`](docs/architecture.md).

## Local development

Requirements: Node.js `>=22.13.0` and pnpm `10.33.0`.

```bash
pnpm install
cp .env.example .env
pnpm dev
```

Run all gates:

```bash
pnpm check
```

The full suite builds the Worker and portable packages and runs web, adapter,
auth, schema, registry and CLI tests.

## Hub API

```text
GET /api/v1/packages?q=vision&limit=20
GET /api/v1/packages/resolve?name=dsh-conversation-exporter
GET /api/v1/profiles?limit=20
GET /api/v1/profiles/{slug}
GET /api/v1/profiles/{slug}/releases/{version}/download
```

Responses include exact source metadata, compatibility, HMR behavior and
ordered profile bundles. Public reads are cacheable for 60 seconds with stale
revalidation. The Go backend owns these endpoints; browser requests use the
web shell's same-origin `/api/*` adapter.

## CLI

```bash
dsh-hub init my-plugin --repository your-name/my-plugin
dsh-hub validate my-plugin
dsh-hub search vision
dsh-hub info dsh-conversation-exporter --version latest
dsh-hub install dsh-conversation-exporter --profile web
dsh-hub profile search team
dsh-hub profile apply <profile-slug> --profile web
dsh-hub profile share <slug> --profile web --version 1.0.0
dsh-hub profile import ./team-profile-1.0.0.dshprofile --profile web
dsh-hub profile history --profile web
dsh-hub profile rollback --profile web
```

Install execution uses argument arrays rather than a shell. A successful apply
keeps the official Profile directory clean and writes Hub state to
`~/.dsh/.hub/installations/<profile>/current.json`. A Release locks the exact
DSH runtime, Plugin versions, sources, integrity and sequence. Apply builds a
staging Profile, validates its structure and composed config through the pinned
official DSH CLI, then atomically switches the target. Previous complete Profile
directories remain available for rollback.

The `.dshprofile` download is a portable recipe containing Release metadata,
`package.json` and `cordis.patch.yml`. It never embeds Plugin code, credentials,
input values, session data or logs. See [`docs/profile-v1.md`](docs/profile-v1.md)
for the V1 contract and V2 boundary.

`dsh-hub init` creates a three-file, schema-valid bundle starter and refuses to
overwrite existing files. Add `--name @scope/my-plugin` when the npm name
differs from the target directory.

`dsh-hub validate` checks package identity, exact version, listing metadata,
GitHub repository and the local Cordis patch before anything reaches npm.

## Publishing

1. Publish a package containing a valid DSH bundle or profile declaration to npm.
2. Wait for automatic discovery, or paste its package name into the public catalog.
3. Sign in at `/dashboard` and select **立即同步** when you want an immediate result.
4. Connect the package repository through the GitHub App to claim and edit its listing.

The Hub reads every published version, validates each manifest, and records
npm's exact tarball URL and integrity. Keywords only discover candidates; a
valid `dsh.bundle` or `dsh.profile` manifest controls catalog admission. The Hub
keeps historical versions and marks versions missing from npm as withdrawn.
It does not host tarballs.

See [`docs/publishing.md`](docs/publishing.md) for the manifest and security
contract. A complete minimal package is available in
[`examples/example-hello`](examples/example-hello).

New teammates should start with [`docs/architecture.md`](docs/architecture.md).

## Staging

Staging uses the Worker `deepseek-harness-plugin-hub-staging`, the shared Hub
backend origin configured by `HUB_API_ORIGIN`, and
`https://staging.dshpluginhub.ai`.

```bash
pnpm deploy:staging
```

Secret names are documented in `.env.example`. Store them with `wrangler secret
put`; never commit their values.

When using AuthKit Hosted UI, configure `/sign-in` as the WorkOS Sign-in
endpoint (`initiate_login_uri`) and leave the AuthKit external login URI empty.
The external login field is reserved for applications that provide their own
authentication UI and complete the `external_auth_id` flow.

## Security invariants

- WorkOS sessions protect the dashboard and management API.
- The web shell has no database binding; all product persistence belongs to the
  Go Hub backend.
- npm responses are bound to the requested package name and exact manifest version.
- npm search keywords only create candidates; the DSH manifest is the admission gate.
- Public manifests contain only the install-relevant package fields; npm user,
  maintainer and operational metadata are discarded before storage.
- npm tarball sources are HTTPS URLs and retain npm integrity metadata when present.
- Automatically discovered packages start unclaimed.
- Repository access through the GitHub App proves a publisher claim.
- Published package versions are immutable.
- GitHub integration is optional.
- GitHub OAuth state is HMAC-signed, short-lived, user-bound and nonce-bound.
- Callback `installation_id` is accepted only after the current GitHub user can
  list that installation and its repositories.
- GitHub user access tokens and installation tokens are never stored.
- GitHub App private keys and OAuth client secrets are Worker secrets.
- Public publication excludes private repositories.
- Abuse reports use Turnstile and are validated and persisted by the Hub backend.

## License and independence

This repository is an independent community project. It has no affiliation,
authorization, or endorsement from DeepSeek.
