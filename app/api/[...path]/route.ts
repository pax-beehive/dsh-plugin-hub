import { env } from "cloudflare:workers";
import { fetchHub, isPublicHubRead } from "@/lib/cloudflare-fetch";

// Headers that must not be forwarded between hops (RFC 2616 §13.5.1), plus
// content-length/content-encoding which the runtime recalculates when the
// response body is streamed (and possibly decompressed) through this proxy.
const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "content-length",
  "content-encoding",
]);

function resolveHubApiOrigin(): string | null {
  const configured = env.HUB_API_ORIGIN ?? process.env.HUB_API_ORIGIN;
  return configured ? configured.replace(/\/$/, "") : null;
}

async function proxyToHubApi(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  const origin = resolveHubApiOrigin();
  if (!origin) {
    return Response.json({ error: "hub_api_not_configured" }, { status: 503 });
  }

  const { path } = await context.params;
  const url = new URL(request.url);
  const target = `${origin}/api/${path.map(encodeURIComponent).join("/")}${url.search}`;
  const publicRead = isPublicHubRead(request.method, target);

  const headers = new Headers();
  for (const name of ["content-type", "origin", "user-agent"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  if (!publicRead) {
    const cookie = request.headers.get("cookie");
    if (cookie) headers.set("cookie", cookie);
  }
  const clientIp =
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for");
  if (clientIp) headers.set("x-forwarded-for", clientIp);

  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  const startedAt = performance.now();
  const response = await fetchHub(target, {
    method: request.method,
    headers,
    body: hasBody ? request.body : undefined,
    // Required by undici when forwarding a streaming request body.
    ...(hasBody ? { duplex: "half" } : {}),
  } as RequestInit);

  const responseHeaders = new Headers();
  response.headers.forEach((value, name) => {
    if (!HOP_BY_HOP_HEADERS.has(name.toLowerCase())) {
      responseHeaders.set(name, value);
    }
  });
  const hubDuration = performance.now() - startedAt;
  responseHeaders.set("server-timing", `hub;dur=${hubDuration.toFixed(1)}`);
  responseHeaders.set(
    "x-dsh-hub-cache",
    response.headers.get("cf-cache-status") ?? "unknown",
  );

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });
}

export const GET = proxyToHubApi;
export const POST = proxyToHubApi;
export const PATCH = proxyToHubApi;
export const PUT = proxyToHubApi;
export const DELETE = proxyToHubApi;
