import type { Attribution } from "./attribution.ts";

export const COLLECT_EVENTS = [
  "copy_install",
  "sign_in_success",
  "sign_in_start",
  "page_view",
] as const;

export type CollectEventName = (typeof COLLECT_EVENTS)[number];

export type CollectPayload = {
  event: CollectEventName;
  event_id?: string;
  props?: Record<string, string>;
};

export type AdsEnv = Record<string, string | undefined>;

const PROP_KEYS = ["package", "profile", "command", "path"] as const;
const CAPI_EVENTS = new Set<CollectEventName>(["copy_install", "sign_in_success"]);

export function isCollectEventName(value: unknown): value is CollectEventName {
  return typeof value === "string" && (COLLECT_EVENTS as readonly string[]).includes(value);
}

export function sanitizeCollectProps(
  props: unknown,
): Record<string, string> | undefined {
  if (!props || typeof props !== "object") return undefined;
  const sanitized: Record<string, string> = {};
  for (const key of PROP_KEYS) {
    const value = (props as Record<string, unknown>)[key];
    if (typeof value === "string" && value.trim()) {
      sanitized[key] = value.trim().slice(0, 300);
    }
  }
  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

export function parseCollectBody(value: unknown): CollectPayload | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (!isCollectEventName(record.event)) return null;
  const eventId =
    typeof record.event_id === "string" && record.event_id.trim()
      ? record.event_id.trim().slice(0, 128)
      : undefined;
  return {
    event: record.event,
    event_id: eventId,
    props: sanitizeCollectProps(record.props),
  };
}

export function resolveChatgptCapiConfig(
  env: AdsEnv,
): { apiKey: string; pixelId: string } | null {
  const apiKey = env.CHATGPT_CAPI_API_KEY?.trim();
  const pixelId = (
    env.NEXT_PUBLIC_CHATGPT_PIXEL_ID || env.CHATGPT_PIXEL_ID
  )?.trim();
  if (!apiKey || !pixelId) return null;
  return { apiKey, pixelId };
}

export function shouldHashEmailForMatching(env: AdsEnv): boolean {
  return Boolean(
    env.CHATGPT_CAPI_API_KEY?.trim() ||
      env.NEXT_PUBLIC_CHATGPT_PIXEL_ID?.trim() ||
      env.CHATGPT_PIXEL_ID?.trim() ||
      env.NEXT_PUBLIC_GOOGLE_ADS_ID?.trim() ||
      env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim(),
  );
}

export async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export async function hashEmailSha256(email: string): Promise<string> {
  return sha256Hex(email.trim().toLowerCase());
}

type CapiEventType =
  | "custom"
  | "registration_completed"
  | "page_viewed"
  | "lead_created";

export function mapCollectEventToCapi(event: CollectEventName): {
  type: CapiEventType;
  custom_event_name?: string;
  dataType: "custom" | "customer_action" | "contents";
} {
  if (event === "copy_install") {
    return { type: "custom", custom_event_name: "copy_install", dataType: "custom" };
  }
  if (event === "sign_in_success") {
    return { type: "registration_completed", dataType: "customer_action" };
  }
  if (event === "sign_in_start") {
    return { type: "custom", custom_event_name: "sign_in_start", dataType: "custom" };
  }
  return { type: "page_viewed", dataType: "contents" };
}

export function sourceUrlFromAttribution(
  attribution: Attribution | null | undefined,
  fallback = "https://dshpluginhub.ai/",
): string {
  const path = attribution?.landing_path;
  if (path && path.startsWith("/")) {
    return `https://dshpluginhub.ai${path}`;
  }
  return fallback;
}

export function buildChatgptCapiRequest(input: {
  event: CollectEventName;
  eventId: string;
  attribution?: Attribution | null;
  props?: Record<string, string>;
  sourceUrl?: string;
  userAgent?: string;
  ipAddress?: string;
  emailSha256?: string;
  timestampMs?: number;
}): { validate_only: false; integration_source: string; events: unknown[] } {
  const mapped = mapCollectEventToCapi(input.event);
  const user: Record<string, unknown> = {};
  if (input.emailSha256) user.emails_sha256 = [input.emailSha256];
  if (input.ipAddress) user.ip_address = input.ipAddress;
  if (input.userAgent) user.user_agent = input.userAgent;

  const data: Record<string, unknown> = { type: mapped.dataType };
  if (mapped.dataType === "custom" && input.props) {
    if (input.props.package) {
      data.contents = [
        {
          id: input.props.package,
          name: input.props.package,
          content_type: input.props.profile ?? "plugin",
        },
      ];
    }
  }

  const event: Record<string, unknown> = {
    id: input.eventId,
    type: mapped.type,
    timestamp_ms: input.timestampMs ?? Date.now(),
    source_url: input.sourceUrl ?? sourceUrlFromAttribution(input.attribution),
    action_source: "web",
    data,
  };
  if (mapped.custom_event_name) event.custom_event_name = mapped.custom_event_name;
  if (input.attribution?.oppref) event.oppref = input.attribution.oppref;
  if (Object.keys(user).length > 0) event.user = user;

  return {
    validate_only: false,
    integration_source: "dsh_plugin_hub",
    events: [event],
  };
}

export function logCollectEvent(
  event: CollectEventName,
  attribution: Attribution | null,
): void {
  const keys = attribution
    ? Object.keys(attribution).sort().join(",")
    : "";
  console.info(`[collect] ${event}${keys ? ` attribution=${keys}` : ""}`);
}

export async function forwardChatgptCapi(
  input: {
    event: CollectEventName;
    eventId: string;
    attribution?: Attribution | null;
    props?: Record<string, string>;
    sourceUrl?: string;
    userAgent?: string;
    ipAddress?: string;
    emailSha256?: string;
    chatgpt: { apiKey: string; pixelId: string };
  },
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  if (!CAPI_EVENTS.has(input.event)) return;
  const body = buildChatgptCapiRequest(input);
  try {
    await fetchImpl(
      `https://bzr.openai.com/v1/events?pid=${encodeURIComponent(input.chatgpt.pixelId)}`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${input.chatgpt.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      },
    );
  } catch {
    // Pixel / CAPI failures must never fail the user-facing request.
  }
}

export async function recordConversion(input: {
  event: CollectEventName;
  eventId?: string;
  props?: Record<string, string>;
  attribution?: Attribution | null;
  sourceUrl?: string;
  userAgent?: string;
  ipAddress?: string;
  emailSha256?: string;
  chatgpt?: { apiKey: string; pixelId: string } | null;
  fetchImpl?: typeof fetch;
}): Promise<string> {
  const eventId = input.eventId?.trim() || crypto.randomUUID();
  logCollectEvent(input.event, input.attribution ?? null);
  if (input.chatgpt) {
    await forwardChatgptCapi(
      {
        event: input.event,
        eventId,
        attribution: input.attribution,
        props: input.props,
        sourceUrl: input.sourceUrl,
        userAgent: input.userAgent,
        ipAddress: input.ipAddress,
        emailSha256: input.emailSha256,
        chatgpt: input.chatgpt,
      },
      input.fetchImpl,
    );
  }
  return eventId;
}
