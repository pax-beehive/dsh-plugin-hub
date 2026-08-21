# ADR 0004: Optimize Mainland China access within one deployment

- Status: accepted
- Date: 2026-08-21
- Updated: 2026-08-21

## Context

DSH Plugin Hub is deployed as one Vinext application on a Cloudflare Worker.
The Worker server-renders public pages, provides same-origin API and image
adapters, and calls the Go Hub backend on Cloud Run. The Go service and
PostgreSQL remain the only product system of record, as established by
[ADR 0003](0003-frontend-has-no-product-persistence.md).

Mainland China probes on 2026-08-21 did not show a domain-level block. Beijing,
Shanghai, and Shenzhen resolved the domain and returned HTTP 200 with no
critical resource failures. The problem was latency and request amplification:

- `/` loaded in approximately 3.0-5.1 seconds.
- `/plugins` loaded in approximately 5.8-7.5 seconds.
- `/plugins` requested 67 resources; 64 took longer than one second.
- The request set included 35 JavaScript chunks, 23 images, and five speculative
  RSC detail-page fetches.

The current implementation magnifies cross-border latency in several ways:

- high-cardinality catalog links use the framework's default prefetch behavior;
- every visible plugin icon is an eager, hydrated client component;
- `AuthKitProvider` and measurement client code wrap every public page even
  though public catalog components do not consume client-side AuthKit state;
- anonymous HTML and public Hub reads use a 60-second edge TTL, producing
  avoidable cache misses across low-volume edge locations; and
- optional third-party measurement requests are allowed onto the public-page
  critical request graph.

The product will not maintain a Mainland-China-specific application, mirror,
database, route tree, domain, or release pipeline. Cloudflare China Network is
not part of this decision because it currently requires an Enterprise contract,
a separate China Network subscription, ICP approval, and content vetting. It
may later improve delivery of this same deployment, but it must not require an
application fork.

## Decision

Keep one global application deployment and improve Mainland China access by
reducing browser work, increasing safe cache reuse, and keeping optional
third-party work off the public-page critical path.

The following invariants apply:

- `dshpluginhub.ai` remains the only canonical public site.
- The existing Cloudflare Worker remains the web runtime and BFF.
- The Go Hub backend and PostgreSQL remain the only product persistence layer.
- China and global traffic run the same application version and schema.
- Authenticated, personalized, mutation, RSC, and prefetch requests remain
  ineligible for anonymous HTML caching.
- Cache keys may vary by normalized rendered query and `dsh-hub-locale`, but
  not by arbitrary cookies, country, advertising identifiers, or user identity.
- No optimization may make WorkOS session data, Dashboard content, callbacks,
  reports, integration routes, or browser mutations publicly cacheable.

## Progress (2026-08-21)

The decision is accepted. Code and cache batches are on `origin/main` and
production. Remaining measurement and JavaScript work is paused, not cancelled.

Shipped:

- Phase 1.1–1.3: `prefetch={false}` on catalog, category, profile, pagination,
  and guide cards; plugin icons lazy-load with fixed dimensions and low fetch
  priority offscreen; Gravatar stays on the same-origin proxy.
- Phase 1.4–1.5: `AuthKitProvider` lives on the Dashboard document only;
  public pages keep first-party attribution and load gtag/oaiq with
  `lazyOnload`.
- Phase 2: route-specific TTLs (`stable-html` 300s+3600s SWR, `search-html`
  120s+600s, Hub GET 300s, Hub 404 30s, icons 30d), `x-dsh-cache-policy`, and
  HTML cache key namespace `__dsh_cache=v2`. No country vary.
- Phase 0.3–0.4 diagnostics and bypass assertions landed with the cache work.

Paused until explicitly resumed:

- Phase 0.1–0.2: repeatable Beijing / Shanghai / Shenzhen probe matrix
  (peak and off-peak).
- Phase 3: further public-page JavaScript / chunk reduction and a CI budget.
- Phase 4 China re-probes after those batches.
- Acceptance items that need a CN median load ≤4.5s or ≥30% faster, and
  `/plugins` ≤40 resources, stay open until the paused work runs.

Cloudflare China Network remains deferred, not rejected.

## Delivery plan

### Phase 0: Establish the measurement and safety boundary

Status: partial. Diagnostics and cache-bypass assertions shipped. The China
probe matrix is paused.

1. Record repeatable production baselines for `/`, `/plugins`, one plugin
   detail page, `/sign-in`, and `/report` from Beijing, Shanghai, and Shenzhen.
   Capture DNS, HTTP status, TTFB, complete load time, resource count, failed
   resources, and slow resources. **Paused.**
2. Repeat probes during peak and off-peak China hours. A single successful test
   is evidence of reachability, not proof of reliable availability. **Paused.**
3. Preserve `x-dsh-edge-cache`, `x-dsh-hub-cache`, and `Server-Timing`
   diagnostics. Add a cache-policy identifier when route-specific TTLs land so
   production responses reveal the policy that was applied. **Shipped**
   (`x-dsh-cache-policy`).
4. Add regression assertions before changing behavior: anonymous locale
   variants cache independently; authenticated, RSC, prefetch, and mutation
   requests bypass; unsuccessful or cookie-setting responses never populate
   the public cache. **Shipped.**

### Phase 1: Eliminate eager and speculative browser work

Status: shipped on production.

1. Set `prefetch={false}` on high-cardinality catalog links, including plugin
   cards and repeated category, profile, pagination, and guide cards. Keep
   prefetch only on a small number of measured primary-navigation routes.
   Initial `/plugins` navigation must issue no speculative detail-page RSC
   requests.
2. Make plugin icons native lazy-loaded images with fixed dimensions and low
   fetch priority outside the first viewport. Remove `PluginIcon` as a client
   island if the same-origin proxy can guarantee a static fallback response;
   otherwise retain the smallest possible failure handler without eagerly
   loading offscreen icons.
3. Keep Gravatar behind the same-origin validated proxy. Do not expose the
   browser to a new third-party icon origin. Continue the 30-day successful
   image TTL and provide a local fallback when the upstream is unavailable.
4. Move `AuthKitProvider` out of the shared public document unless a concrete
   public client consumer is introduced. Server-side `withAuth` checks and the
   existing callback routes remain unchanged. Verify Dashboard, sign-in,
   sign-out, callback, and GitHub installation flows after moving the boundary.
5. Preserve first-party attribution capture, but defer Google, OpenAI, and
   other optional measurement libraries until idle or an event actually needs
   them. Measurement failure must never delay rendering, navigation, search,
   install-command copying, or form readiness.

### Phase 2: Adopt route-specific cache freshness

Status: shipped on production.

Replace the single public 60-second policy with explicit policies:

| Response class | Edge TTL | Stale window | Notes |
| --- | ---: | ---: | --- |
| Stable anonymous pages and catalog detail pages | 300 s | 3600 s | Locale-aware; cache-versioned |
| Search, sort, and pagination variants | 120 s | 600 s | Normalized rendered parameters only |
| Successful public Hub API reads | 300 s | provider-managed | Explicit allowlist only |
| Public Hub API 404 responses | 30 s | none | Limits stale negative results |
| Plugin icon success responses | 30 days | 7 days | Existing same-origin proxy |
| Auth, Dashboard, callbacks, integrations, reports, and mutations | none | none | `no-store` |
| Upstream 5xx responses | none | none | Never cache failures |

Implementation requirements:

1. Add a cache namespace/version to anonymous HTML keys. Increment it when a
   deployment changes markup or asset compatibility so an increased TTL cannot
   retain incompatible HTML.
2. Keep the existing locale and normalized query behavior. Do not add country
   to the HTML cache key; country variants would fragment an already low-volume
   cache and risk inconsistent application behavior.
3. Verify how Cloudflare Cache API honors `stale-while-revalidate` in the
   deployed Worker. If the runtime does not provide the intended stale behavior,
   retain bounded TTL caching rather than implementing an unbounded application
   stale cache.
4. Treat routine catalog updates as eventually visible within the documented
   TTL. A future targeted purge may reduce that window, but invalidation is not
   allowed to weaken the private-route boundary.

### Phase 3: Reduce public-page JavaScript

Status: paused.

1. Keep catalog browsing, searching, sorting, pagination, and plugin detail
   content server-rendered and usable without hydration.
2. Hydrate only true interaction islands: language switching, package
   submission, copy actions, and forms that need client feedback.
3. Inspect the production build manifest after each boundary change. Remove
   public imports that pull authentication, publisher, or measurement code into
   catalog routes.
4. Add a repeatable public-route performance budget to CI or the release smoke
   check. The budget must fail on unexpected growth in initial JavaScript,
   eager image requests, or speculative RSC requests rather than relying only
   on total transferred bytes.

### Phase 4: Roll out and observe

Status: partial. Batches 1–3 shipped. Batch 4 (JS/chunk reductions) and the
China re-probe matrix are paused.

Ship the work as independently reversible batches:

1. prefetch and icon loading; **shipped**
2. cache-policy and cache-key changes; **shipped**
3. AuthKit and measurement boundary changes; **shipped**
4. remaining JavaScript/chunk reductions. **Paused.**

After each batch, run `pnpm check`, deploy the exact tested revision, verify
production cache headers and auth bypass behavior, and repeat the Mainland China
probe matrix. Cache-policy rollback must also bump the cache namespace so the
rollback cannot reuse responses written under the rejected policy.

## Acceptance criteria

The proposal is complete when all of the following are true:

- `pnpm check` passes and production smoke checks cover public HTML, public API,
  icon proxy, sign-in redirect, Dashboard protection, and report submission
  readiness.
- A second anonymous document request for each supported locale returns
  `x-dsh-edge-cache: HIT`; authenticated, RSC, prefetch, and mutation requests
  return `BYPASS`.
- Initial `/plugins` loading makes zero speculative plugin-detail RSC requests.
- Offscreen plugin icons are not eagerly fetched, and icon failure does not
  require a third-party browser request.
- Initial `/plugins` resource count falls from the observed 67 to at most 40,
  with no increase in HTML failures or missing catalog content. **Open; blocked
  on paused Phase 3.**
- Three consecutive Beijing, Shanghai, and Shenzhen probe rounds have zero
  critical failures and a median complete load time no greater than 4.5 seconds
  or at least 30 percent below the Phase 0 median, whichever target is stricter.
  **Open; blocked on paused Phase 0 probes.**
- The change does not introduce a second production deployment, database,
  domain, locale route tree, or release workflow.

## Considered options

### Separate Mainland China mirror or deployment

Rejected. It would duplicate releases, cache invalidation, auth behavior,
monitoring, and incident response while creating drift between two public
products.

### Send Mainland China browsers directly to Cloud Run

Rejected. It would bypass the established same-origin BFF, expose a new browser
origin, and reintroduce CORS, cookie, CSRF, and origin-protection complexity
without removing cross-border latency.

### Cache every GET response

Rejected. HTTP method alone does not establish that a response is anonymous,
stable, or safe to share. Cacheability remains an explicit route and response
contract.

### Vary HTML by country

Rejected. Region-specific cached HTML would fragment the cache and turn one
deployment into multiple behavioral variants. Optional third-party work is
instead removed from the critical path for all users.

### Purchase Cloudflare China Network now

Deferred, not rejected. It is the future infrastructure option most compatible
with the one-deployment constraint, but current reachability evidence does not
justify its Enterprise, ICP, and operational cost before the code and cache
plan is measured.

## Consequences

- China and global users continue to receive the same product and release.
- Public catalog changes may be visible up to five minutes later on stable
  anonymous routes.
- Analytics page-view delivery becomes best-effort and may be recorded later;
  product interactions and server-side conversion events remain authoritative.
- Below-the-fold icons appear as users approach them instead of during initial
  page load.
- Fewer requests and higher cache reuse should materially improve cross-border
  performance, but this decision cannot guarantee availability across every
  Mainland China ISP because the deployment remains outside the China Network.
- If the acceptance target remains unmet after seven days of representative
  measurements, reconsider Cloudflare China Network for this same deployment;
  do not introduce a regional application fork without a superseding ADR.
