# Profile V1 contract

Status: implemented in the web workspace and Go API. Production deployment is
a separate release operation.

## Product surface

V1 supports two creation paths:

1. Build and publish an ordered Profile in the authenticated Web Builder.
2. Capture the current official local Profile and share it with one CLI command.

Anyone can inspect and install a public Release anonymously. Users may execute
the workflow directly with `dsh-hub`, through the DSH tool bundle, or through
the bundled agent Skill.

## Draft and Release

- A Draft is owner-editable and records DSH compatibility, ordered bundles,
  selectors, the user patch and an Input Contract.
- Publishing resolves every indexed npm or GitHub bundle to an exact version,
  install spec and integrity. Official DSH-owned bundles lock to the exact DSH
  runtime.
- A Release is immutable SemVer content with a canonical SHA-256 content hash.
- Release order is the Profile's exact bundle order. `before` and `after`
  constraints are validated without reordering that sequence.
- Input declarations may name local environment variables. Values and secrets
  never enter the Hub.

## Local execution

The CLI is the local execution authority:

1. Resolve a public Release or verify a downloaded `.dshprofile` recipe.
2. Check the release content hash and required local inputs.
3. Build a disposable Profile under `$DSH_HOME/profiles`.
4. Install out-of-tree bundles with the exact locked DSH runtime and install
   specs. Installation-owned bundles come from that runtime.
5. Validate the package structure and run the official DSH `--dump-config`.
6. Move the current complete Profile into revision history and atomically rename
   the validated staging directory into place.
7. Record Hub state under
   `$DSH_HOME/.hub/installations/<profile>/current.json`.

Rollback restores a complete prior Profile directory, including its installed
dependencies. It does not reverse Plugin-managed database migrations or
external side effects.

Plan/apply automation creates an expiring, single-use operation with a
current-state precondition. Install/upgrade and rollback bind the current Hub
content identity; share binds a fingerprint of the captured local Profile. The
DSH tool bundle exposes install, share and rollback planning, confirmed apply,
and history operations. The Skill requires presenting the exact changes and
obtaining confirmation before every mutation.

## Portable recipe

The `.dshprofile` ZIP contains:

```text
release.json
profile/package.json
profile/cordis.patch.yml
```

It contains no Plugin archives, credentials, input values, session data or
logs. Installation still downloads the locked npm or public GitHub sources.

## V1 boundary

V1 accepts Plugins already indexed from npm or public GitHub sources. Plugin
artifact hosting and Plugin publication through the Hub are V2. V1 therefore
needs no new object storage, KMS key, artifact signing service or private source
distribution path.

## Deployment order

1. Apply Go migration `000008_profile_drafts`.
2. Deploy the Go API with `WORKOS_CLIENT_ID` and existing database settings.
3. Deploy the web workspace with its API proxy targeting that service.
4. Publish the CLI and optional DSH bundle packages.
5. Smoke-test Draft save, Release publish, anonymous download, CLI plan/apply,
   direct share and rollback before enabling the Profile entry publicly.
