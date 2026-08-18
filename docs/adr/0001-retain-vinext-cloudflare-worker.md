# ADR 0001: Retain the existing vinext Cloudflare Worker shell

- Status: accepted
- Date: 2026-08-18

## Context

The repository already contains a production-oriented bilingual waitlist built with Next.js App Router, vinext, Cloudflare Workers, D1 migrations, security headers, and behavior tests. The original Hub proposal mentioned React Router for SSR and API routes.

## Decision

Keep the existing vinext/Next application as the web shell and move the project to a pnpm workspace. Put portable domain contracts, registry logic, and the public CLI in separate workspace packages:

- `@dsh-plugin-hub/schemas`
- `@dsh-plugin-hub/registry`
- `@dsh-plugin-hub/cli`

The web shell remains replaceable because domain code cannot import Next.js, vinext, or Cloudflare runtime modules. API handlers may depend on the portable packages.

## Consequences

- Existing waitlist data, routes, SEO assets, and deployment tests remain intact.
- The Hub gains independently publishable packages without a rewrite of the working landing site.
- HMR for the Hub web application follows vinext/Vite. DSH profile HMR remains a separate Cordis behavior represented by registry metadata and documentation.
- A future React Router migration can replace the web shell without changing the registry contracts or CLI protocol.
