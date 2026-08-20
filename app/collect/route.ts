import {
  parseCollectBody,
  recordConversion,
  resolveChatgptCapiConfig,
} from "@/lib/collect";
import { readAdsEnv } from "@/lib/ads-env";
import { readAttributionFromCookieHeader } from "@/lib/attribution";

const WINDOW_MS = 60_000;
const MAX_EVENTS = 40;
const recentHits = new Map<string, number[]>();

function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

function clientIp(request: Request): string | undefined {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    undefined
  );
}

function allowRequest(ip: string | undefined): boolean {
  const key = ip || "unknown";
  const now = Date.now();
  const times = (recentHits.get(key) ?? []).filter((time) => now - time < WINDOW_MS);
  if (times.length >= MAX_EVENTS) {
    recentHits.set(key, times);
    return false;
  }
  times.push(now);
  recentHits.set(key, times);
  return true;
}

function noContent(): Response {
  return new Response(null, { status: 204 });
}

export async function POST(request: Request): Promise<Response> {
  if (!isSameOrigin(request)) {
    return Response.json({ error: "invalid_origin" }, { status: 403 });
  }
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return Response.json({ error: "invalid_content_type" }, { status: 415 });
  }
  if (!allowRequest(clientIp(request))) {
    return noContent();
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = parseCollectBody(body);
  if (!parsed) {
    return Response.json({ error: "invalid_event" }, { status: 400 });
  }

  const env = readAdsEnv();
  await recordConversion({
    event: parsed.event,
    eventId: parsed.event_id,
    props: parsed.props,
    attribution: readAttributionFromCookieHeader(request.headers.get("cookie")),
    sourceUrl: request.headers.get("referer") ?? undefined,
    userAgent: request.headers.get("user-agent") ?? undefined,
    ipAddress: clientIp(request),
    chatgpt: resolveChatgptCapiConfig(env),
  });

  return noContent();
}

export function GET(): Response {
  return new Response(null, { status: 405, headers: { allow: "POST" } });
}
