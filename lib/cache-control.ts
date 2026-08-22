export const STABLE_HTML_CACHE_CONTROL =
  "public, s-maxage=300, stale-while-revalidate=3600";
export const SEARCH_HTML_CACHE_CONTROL =
  "public, s-maxage=120, stale-while-revalidate=600";
export const HUB_API_SUCCESS_CACHE_CONTROL = "public, s-maxage=300";
export const HUB_API_NOT_FOUND_CACHE_CONTROL = "public, s-maxage=30";
export const PLUGIN_ICON_CACHE_CONTROL =
  "public, max-age=86400, s-maxage=2592000, stale-while-revalidate=604800";
export const PRIVATE_CACHE_CONTROL = "no-store";

/** @deprecated Use STABLE_HTML_CACHE_CONTROL. Kept as the default public HTML policy. */
export const PUBLIC_CACHE_CONTROL = STABLE_HTML_CACHE_CONTROL;

export type CachePolicy =
  | "stable-html"
  | "search-html"
  | "plugin-icon"
  | "hub-api"
  | "hub-api-404"
  | "no-store";

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
  "/integrations/",
  "/auth/",
];

const PUBLIC_HUB_API = [
  /^\/api\/v1\/categories$/,
  /^\/api\/v1\/packages(?:\/[^/]+)?$/,
  /^\/api\/v1\/profiles(?:\/[^/]+)?$/,
  /^\/api\/v1\/source-listings$/,
];

export function isPersonalizedPath(pathname: string): boolean {
  if (PRIVATE_EXACT.has(pathname)) return true;
  if (pathname.startsWith("/api/")) return true;
  return PRIVATE_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isPublicHubApiPath(pathname: string): boolean {
  return PUBLIC_HUB_API.some((pattern) => pattern.test(pathname));
}

function isSearchVariant(url: URL): boolean {
  if (url.pathname === "/plugins") {
    const query = (url.searchParams.get("q") ?? "").trim();
    const page = url.searchParams.get("page");
    const sort = url.searchParams.get("sort");
    return Boolean(
      query ||
        (page && page !== "1") ||
        (sort && sort !== "popular"),
    );
  }
  if (url.pathname === "/profiles") {
    return Boolean((url.searchParams.get("q") ?? "").trim());
  }
  return false;
}

function hasWorkosSession(request: Request): boolean {
  const cookie = request.headers.get("cookie") ?? "";
  return cookie
    .split(";")
    .some((part) => part.trim().startsWith("wos-session="));
}

export function cacheDecision(
  request: Request,
  status = 200,
): { control: string; policy: CachePolicy } {
  const method = request.method.toUpperCase();
  if (method !== "GET" && method !== "HEAD") {
    return { control: PRIVATE_CACHE_CONTROL, policy: "no-store" };
  }

  const url = new URL(request.url);
  const pathname = url.pathname;

  if (pathname.startsWith("/plugin-icons/gravatar/")) {
    return { control: PLUGIN_ICON_CACHE_CONTROL, policy: "plugin-icon" };
  }

  if (hasWorkosSession(request)) {
    return { control: PRIVATE_CACHE_CONTROL, policy: "no-store" };
  }

  if (isPublicHubApiPath(pathname)) {
    if (status === 404) {
      return { control: HUB_API_NOT_FOUND_CACHE_CONTROL, policy: "hub-api-404" };
    }
    if (status >= 200 && status < 300) {
      return { control: HUB_API_SUCCESS_CACHE_CONTROL, policy: "hub-api" };
    }
    return { control: PRIVATE_CACHE_CONTROL, policy: "no-store" };
  }

  if (isPersonalizedPath(pathname)) {
    return { control: PRIVATE_CACHE_CONTROL, policy: "no-store" };
  }

  if (isSearchVariant(url)) {
    return { control: SEARCH_HTML_CACHE_CONTROL, policy: "search-html" };
  }

  return { control: STABLE_HTML_CACHE_CONTROL, policy: "stable-html" };
}

export function cacheControlFor(request: Request, status = 200): string {
  return cacheDecision(request, status).control;
}

export function cachePolicyFor(request: Request, status = 200): CachePolicy {
  return cacheDecision(request, status).policy;
}

function appendVary(headers: Headers, needed: string[]) {
  const parts = (headers.get("vary") ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  for (const header of needed) {
    if (!parts.some((part) => part.toLowerCase() === header.toLowerCase())) {
      parts.push(header);
    }
  }
  headers.set("vary", parts.join(", "));
}

export function applyCacheHeaders(
  headers: Headers,
  request: Request,
  status = 200,
) {
  const { control, policy } = cacheDecision(request, status);
  headers.set("cache-control", control);
  headers.set("x-dsh-cache-policy", policy);
  if (policy === "stable-html" || policy === "search-html") {
    appendVary(headers, ["Cookie", "Accept-Language"]);
  }
}
