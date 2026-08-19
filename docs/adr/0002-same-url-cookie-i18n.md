# ADR 0002: CN / EN share the same URL

- Status: accepted
- Date: 2026-08-18

## Context

The Hub supports Chinese and English. Product direction requires language switching without a parallel `/en/...` route tree.

## Decision

Use the `dsh-hub-locale` cookie with values `zh` or `en`.

- Server Components read the cookie through `getHubLocale()`.
- Client Components receive an explicit locale prop.
- `LanguageSwitch` updates the cookie and reloads the current URL.
- Existing `/en` links receive a 308 compatibility redirect that stores `en` and returns to `/`.
- Plugin and profile publisher content stays in its submitted language.
- The sitemap exposes each canonical URL once.

## Consequences

- Links remain stable across languages.
- AuthKit and GitHub callback URLs require no locale variants.
- HTML and metadata depend on a cookie, so the Worker must render these pages dynamically.
- Search engines see one canonical URL rather than separately indexable translations.
- Any future CDN page caching must include the locale cookie in its cache key or skip caching localized HTML.
