import { isPersonalizedPath } from "./cache-control.ts";
import {
  HUB_LOCALE_COOKIE,
  resolveHubLocale,
  type HubLocale,
} from "./i18n.ts";

export type EdgeCacheStatus = "HIT" | "MISS" | "BYPASS";

function readCookie(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  for (const item of cookieHeader.split(";")) {
    const [cookieName, ...value] = item.trim().split("=");
    if (cookieName === name) {
      try {
        return decodeURIComponent(value.join("="));
      } catch {
        return value.join("=");
      }
    }
  }
  return null;
}

export function requestLocale(request: Request): HubLocale {
  return resolveHubLocale(
    readCookie(request.headers.get("cookie"), HUB_LOCALE_COOKIE),
    request.headers.get("accept-language"),
  );
}

function hasWorkosSession(request: Request): boolean {
  return readCookie(request.headers.get("cookie"), "wos-session") !== null;
}

function isRscOrPrefetch(request: Request): boolean {
  return (
    request.headers.get("rsc") === "1" ||
    request.headers.has("next-router-state-tree") ||
    request.headers.has("next-router-prefetch") ||
    request.headers.get("purpose")?.toLowerCase() === "prefetch" ||
    request.headers.get("sec-purpose")?.toLowerCase().includes("prefetch") ===
      true
  );
}

export function isPublicHtmlCacheRequest(request: Request): boolean {
  if (request.method !== "GET") return false;
  const url = new URL(request.url);
  if (isPersonalizedPath(url.pathname)) return false;
  if (request.headers.has("authorization") || hasWorkosSession(request)) {
    return false;
  }
  if (isRscOrPrefetch(request)) return false;
  return request.headers.get("accept")?.toLowerCase().includes("text/html") === true;
}

function publicPageSearch(url: URL): URLSearchParams {
  const normalized = new URLSearchParams();
  if (url.pathname === "/plugins" || url.pathname === "/profiles") {
    const query = (url.searchParams.get("q") ?? "").trim().slice(0, 120);
    if (query) normalized.set("q", query);
  }
  if (url.pathname === "/plugins") {
    const page = Math.max(
      Number.parseInt(url.searchParams.get("page") ?? "1", 10) || 1,
      1,
    );
    if (page > 1) normalized.set("page", String(page));
    const sort = url.searchParams.get("sort");
    if (sort === "rising" || sort === "updated") {
      normalized.set("sort", sort);
    }
  }
  normalized.sort();
  return normalized;
}

export function publicPageCacheKey(request: Request): Request {
  const url = new URL(request.url);
  url.hash = "";
  url.search = publicPageSearch(url).toString();
  url.searchParams.set("__dsh_cache", "v5");
  url.searchParams.set("__dsh_locale", requestLocale(request));
  url.searchParams.sort();
  return new Request(url, {
    headers: { accept: "text/html" },
    method: "GET",
  });
}

export function isCacheablePublicHtmlResponse(response: Response): boolean {
  return (
    response.status === 200 &&
    response.headers.get("content-type")?.toLowerCase().includes("text/html") ===
      true &&
    !response.headers.has("set-cookie")
  );
}

export function withEdgeDiagnostics(
  response: Response,
  status: EdgeCacheStatus,
  durationMs: number,
): Response {
  const headers = new Headers(response.headers);
  headers.set("x-dsh-edge-cache", status);
  const timing = `worker;dur=${durationMs.toFixed(1)}, edge-cache;desc="${status.toLowerCase()}"`;
  const existing = headers.get("server-timing");
  headers.set("server-timing", existing ? `${existing}, ${timing}` : timing);
  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}
