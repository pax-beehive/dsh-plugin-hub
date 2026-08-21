# Web architecture

## Runtime map

```text
Browser
  |
  v
Cloudflare Worker (this repository)
  |- Vinext App Router: SSR and React Server Components
  |- locale-aware anonymous HTML edge cache
  |- client islands: forms, language switch, copy actions, pixels
  |- /api/* same-origin adapter with public-read upstream cache
  |- same-origin Gravatar image proxy
  |- WorkOS and GitHub callback adapters
  `- cache and security policy
            |
            v
api.dshpluginhub.ai (Go Hub backend)
  |- catalog and publisher HTTP interfaces
  |- WorkOS session verification
  |- npm and GitHub ingestion
  |- scheduled discovery and sync
  `- PostgreSQL system of record
```

## Ownership

The web shell owns presentation, server rendering, browser interaction,
same-origin request forwarding, authentication redirects/callbacks, metadata,
analytics and edge response policy. It has no product database binding.

The Go Hub backend owns catalog state, publisher state, identity records,
publication, abuse reports, discovery, synchronization and scheduling.

The workspace packages are portable product modules:

- `@dsh-plugin-hub/schemas` owns wire and manifest contracts.
- `@dsh-plugin-hub/registry` owns deterministic version and profile resolution.
- `@dsh-plugin-hub/cli` owns local installation and lockfile behaviour.

## Seams

### Server-rendered reads

`lib/hub-api.ts` is the typed adapter used by Server Components. It validates
Hub responses with Zod and forwards the WorkOS session cookie only for
publisher calls.

### Browser reads and writes

`app/api/[...path]/route.ts` forwards same-origin `/api/*` requests to
`HUB_API_ORIGIN`. It forwards only required headers and removes hop-by-hop
response headers. Browser callers never need the backend origin or a CORS
configuration of their own.

### Callback writes

`lib/hub-internal.ts` is the internal adapter for WorkOS user upserts and
GitHub installation claims. It uses the shared internal bearer token and is
not exposed to browser code.

### Shared Chrome

`components/SiteDocument.tsx` owns the document, AuthKit provider, global
metadata hooks and measurement modules. `components/HubHeader.tsx` owns the
shared header Chrome for both the public catalog and Publisher Console.

## Rendering and caching

Public localized HTML is dynamically rendered because language is selected by
the `dsh-hub-locale` cookie. Anonymous document navigations use two explicit
edge-cache variants (`zh` and `en`) with route-specific normalized query keys.
RSC, prefetch, authenticated and personalized requests bypass that cache.

Public Hub API GETs use Cloudflare's fetch cache before reaching the Tokyo
Cloud Run origin. Browser-facing `/api/*`, Dashboard, auth, callback and
integration responses remain `no-store`; no management read or mutation is
eligible for the upstream cache.

Backend-provided Gravatar URLs are rewritten to the same-origin
`/plugin-icons/gravatar/:hash` adapter. The adapter accepts only an MD5-shaped
hash, fixes the upstream size and fallback, and caches successful images for 30
days at the edge.

Smart Placement is enabled so Cloudflare may move dynamic execution closer to
the Hub API when that reduces end-to-end request duration. Static Worker assets
continue to be served near the incoming request.

## Change rules

- Do not import a database adapter from `app/`, `components/` or `lib/`.
- Add product persistence and ingestion behavior to the Go Hub backend.
- Change shared response shapes in the portable schemas and coordinate both
  repositories.
- Keep browser mutations on the same-origin `/api/*` path.
- Keep public and Publisher Console navigation in the shared Header Chrome.
- Add new cacheable Hub endpoints to the explicit public-read allowlist; never
  infer cacheability from `GET` alone.
