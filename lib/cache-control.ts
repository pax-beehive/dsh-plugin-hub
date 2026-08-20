export const PUBLIC_CACHE_CONTROL =
  "public, s-maxage=60, stale-while-revalidate=300";
export const PRIVATE_CACHE_CONTROL = "no-store";

const PRIVATE_EXACT = new Set([
  "/dashboard",
  "/sign-in",
  "/sign-out",
  "/callback",
  "/collect",
  "/report",
]);

const PRIVATE_PREFIXES = [
  "/dashboard/",
  "/sign-in/",
  "/sign-out/",
  "/callback/",
  "/collect/",
  "/report/",
  "/api/",
  "/integrations/",
  "/auth/",
];

export function isPersonalizedPath(pathname: string): boolean {
  if (PRIVATE_EXACT.has(pathname)) return true;
  return PRIVATE_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function cacheControlFor(request: Request): string {
  const method = request.method.toUpperCase();
  if (method !== "GET" && method !== "HEAD") return PRIVATE_CACHE_CONTROL;
  const pathname = new URL(request.url).pathname;
  if (isPersonalizedPath(pathname)) return PRIVATE_CACHE_CONTROL;
  return PUBLIC_CACHE_CONTROL;
}

export function applyCacheHeaders(headers: Headers, request: Request) {
  const value = cacheControlFor(request);
  headers.set("cache-control", value);
  if (value === PUBLIC_CACHE_CONTROL) {
    const vary = headers.get("vary");
    if (!vary) headers.set("vary", "Cookie");
    else if (!/\bcookie\b/i.test(vary)) headers.set("vary", `${vary}, Cookie`);
  }
}
