# Publishing contract

DSH Plugin Hub discovers and syncs packages from npm. Anyone may submit a
package name for validation; signed-in publishers may request an immediate
sync. GitHub App installation is only required when an author wants to claim a
repository and edit its catalog listing.

## Copyable starter

The repository includes a complete three-file example at
[`examples/example-hello`](../examples/example-hello). Copy that directory,
then change the package name, display text, repository URL, Cordis entry id and
version. Its package contents and Hub metadata are checked by the test suite so
new publishers have a working reference rather than an incomplete snippet.

The CLI can generate the same contract without copying files manually:

```bash
dsh-hub init my-plugin --repository your-name/my-plugin
```

Use `--name @your-scope/my-plugin` for a scoped npm package. The command stops
when any target starter file already exists.

Validate the result before publishing:

```bash
dsh-hub validate my-plugin
```

Validation also rejects missing patches, directory traversal, symlink escapes,
invalid exact versions and listing entry IDs absent from the Cordis patch.

## Bundle package

`package.json` must contain the official DSH bundle shape and an exact semantic
version:

```json
{
  "name": "dsh-example",
  "version": "1.2.3",
  "description": "Example DSH plugin",
  "license": "MIT",
  "dsh": {
    "bundle": {
      "patch": "./cordis.patch.yml"
    }
  }
}
```

## Profile package

The declared bundle array is ordered. Selectors come from `dependencies`.

```json
{
  "name": "dsh-example-profile",
  "version": "1.0.0",
  "dependencies": {
    "dsh-example": "^1.2.0",
    "dsh-tools": "3.1.0"
  },
  "dsh": {
    "profile": {
      "bundles": ["dsh-tools", "dsh-example"]
    }
  }
}
```

Order matters because later Cordis/config layers may override earlier rows.
Hub preserves the declared sequence and checks explicit `before` / `after`
rules before installation.

## Optional listing metadata

For direct npm publication, put listing metadata at `dsh.hub` inside
`package.json` so it is present in npm's version metadata:

```json
{
  "dsh": {
    "bundle": { "patch": "./cordis.patch.yml" },
    "hub": {
      "schemaVersion": 1,
      "displayName": "Example",
      "summary": "One sentence shown in search results.",
      "description": "Longer plain-text description.",
      "homepage": "https://example.com",
      "categories": ["workflow"],
      "keywords": ["automation", "tools"],
      "iconUrl": "https://example.com/icon.png",
      "screenshots": [
        {
          "url": "https://example.com/screenshot.png",
          "alt": "Example plugin settings"
        }
      ],
      "compatibility": {
        "dsh": ">=0.1.0-rc.7",
        "node": ">=22",
        "platforms": ["darwin", "linux"],
        "surfaces": ["web"],
        "hmr": "refresh"
      },
      "entryIds": ["example"],
      "before": [],
      "after": ["dsh-base"],
      "channel": "stable"
    }
  }
}
```

`dshHub` at the package root is also accepted. The optional `dsh-hub.json`
file remains available to GitHub repository sync.

Allowed HMR values:

- `full`: plugin can apply and dispose without a host restart
- `config`: configuration re-composition is enough
- `refresh`: web/client refresh is required
- `restart`: process restart is required

`sideEffects: false` in `package.json` is displayed as publisher metadata only
after a later size-analysis phase. Hub never guesses that arbitrary plugin
entry points are safe to tree-shake.

## Version rules

- `package.json.version` must be exact SemVer.
- The tuple `(package, version)` is immutable after first sync.
- npm dist-tags decide the current tagged versions; the Hub does not infer a
  replacement `latest` tag.
- A new npm version creates a new immutable Hub version.
- Versions missing from a later npm packument are retained and marked withdrawn.
- npm deprecation is displayed and never causes silent history deletion.
- Claimed authors may update search copy, screenshots, categories, compatibility
  notes and HMR behavior without rewriting stored version sources.
- The primary source is npm's exact tarball URL and integrity metadata.

## Discovery and sync

The staging Worker runs discovery every six hours. It searches npm using a
small set of DSH-related queries, rotates through up to the first 1,000 results
per query, and sends candidates to a Cloudflare Queue. Existing accepted
packages are also rescheduled so later npm releases appear automatically.

Search tags are hints only. A package reaches the public catalog after at least
one version passes the bundle or profile schema. Failed network requests retry
with backoff; manifest rejections are recorded and checked again later.

The public catalog's package field is a one-time acceleration path. It is
same-origin protected and rate-limited. The signed-in Dashboard's **立即同步**
action waits for npm validation and returns the result directly.

Hub stores npm metadata and source pointers. Installation downloads remain on
the npm Registry; no tarball is copied into Cloudflare storage.

## Automatic security flow

1. Hub validates the submitted npm package name.
2. Hub requests its packument from the official npm Registry.
3. The returned package name must exactly match the requested name.
4. Every admitted version must pass the DSH manifest, exact SemVer and HTTPS
   distribution-source checks.
5. Hub rebuilds the public manifest from an allowlist and writes immutable
   version records.

Before storage, Hub rebuilds the public manifest from an allowlist of
install-relevant fields. npm-added maintainer contacts, publishing identities,
distribution internals and other registry metadata are not mirrored into the
Hub API. Tarball URL, integrity, unpacked size and file count remain in the
separate immutable source record.

## Author claim

1. WorkOS identifies the publisher.
2. The publisher installs the GitHub App on the package repository.
3. Hub verifies the OAuth state, GitHub identity, installation and selected
   repository access.
4. The repository's package identity must match the npm package already synced.
5. Hub assigns the claim, after which that WorkOS user may edit direct listing
   fields in the Dashboard.

GitHub user and installation tokens are short-lived and are never stored.
Future npm syncs preserve author-managed listing fields.
