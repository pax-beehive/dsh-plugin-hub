# ADR 0003: The web shell has no product persistence

- Status: accepted
- Date: 2026-08-21

## Context

The repository originally contained a complete D1 implementation for the
waitlist, Registry reads, npm ingestion, GitHub discovery, publication,
identity and abuse reports. Production has since moved those responsibilities
to the Go Hub backend on Cloud Run with PostgreSQL.

Keeping the retired implementation compiled and tested in the web repository
created two apparent systems of record. It also left D1 bindings, migrations,
secrets and operational commands that no production route used.

## Decision

The Vinext web shell has no product database and owns no ingestion pipeline.

- Server-rendered pages read through `lib/hub-api.ts`.
- Browser reads and writes use the same-origin `/api/*` adapter.
- WorkOS and GitHub callbacks use `lib/hub-internal.ts` for authenticated
  server-to-server writes.
- The Go Hub backend owns persistence, validation, ingestion, scheduling,
  publication and abuse-report storage.
- Portable manifest contracts and resolution logic remain in the workspace
  packages because they are shared product interfaces, not web persistence.

Retired D1 stores, migrations, ingestion modules, one-time migration scripts
and their implementation tests are removed. Git history remains the archive.

## Consequences

- There is one production system of record and one obvious data seam.
- Frontend tests exercise adapters and rendered behaviour instead of a second
  backend implementation.
- Backend contract changes must be coordinated with the Go repository and the
  portable schemas.
- Restoring a web-local database requires a new ADR rather than adding an
  incidental Worker binding.
