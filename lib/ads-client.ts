import {
  ATTRIBUTION_COOKIE,
  SIGNUP_EVENT_COOKIE,
  attributionSetCookie,
  captureAttribution,
  parseAttributionCookie,
  readCookieValue,
} from "./attribution.ts";

export type ClientCollectEvent =
  | "copy_install"
  | "sign_in_success"
  | "sign_in_start"
  | "page_view";

export type AdsClientConfig = {
  googleAdsId?: string;
  installLabel?: string;
  signupLabel?: string;
};

type OaiqFn = ((...args: unknown[]) => void) & { q?: unknown[] };

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    oaiq?: OaiqFn;
    __DSH_ADS?: AdsClientConfig;
  }
}

export function readBrowserCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  return readCookieValue(document.cookie, name);
}

export function captureClientFirstTouch(): void {
  if (typeof document === "undefined" || typeof window === "undefined") return;
  if (parseAttributionCookie(readBrowserCookie(ATTRIBUTION_COOKIE))) return;
  const attribution = captureAttribution({
    url: window.location.href,
    referrer: document.referrer,
  });
  document.cookie = attributionSetCookie(attribution, {
    secure: window.location.protocol === "https:",
  });
}

export function consumeSignupEventId(): string | undefined {
  if (typeof document === "undefined") return undefined;
  const eventId = readBrowserCookie(SIGNUP_EVENT_COOKIE);
  if (!eventId) return undefined;
  document.cookie = `${SIGNUP_EVENT_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
  return eventId;
}

function fireGoogleConversion(event: ClientCollectEvent, eventId: string): void {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  const config = window.__DSH_ADS ?? {};
  const adsId = config.googleAdsId || process.env.NEXT_PUBLIC_GOOGLE_ADS_ID;
  if (!adsId) return;
  const label =
    event === "copy_install"
      ? config.installLabel ||
        process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL_INSTALL
      : event === "sign_in_success"
        ? config.signupLabel ||
          process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL_SIGNUP
        : "";
  if (!label) return;
  window.gtag("event", "conversion", {
    send_to: `${adsId}/${label}`,
    transaction_id: eventId,
  });
}

function fireChatgptPixel(event: ClientCollectEvent, eventId: string): void {
  if (typeof window === "undefined" || typeof window.oaiq !== "function") return;
  if (event === "copy_install") {
    window.oaiq(
      "measure",
      "custom",
      { type: "custom" },
      { custom_event_name: "copy_install", event_id: eventId },
    );
    return;
  }
  if (event === "sign_in_success") {
    window.oaiq(
      "measure",
      "registration_completed",
      { type: "customer_action" },
      { event_id: eventId },
    );
  }
}

export async function trackHubEvent(
  event: ClientCollectEvent,
  options: {
    eventId?: string;
    props?: Record<string, string | undefined>;
    collect?: boolean;
  } = {},
): Promise<string> {
  const eventId = options.eventId?.trim() || crypto.randomUUID();
  const props = Object.fromEntries(
    Object.entries(options.props ?? {}).filter(
      (entry): entry is [string, string] => Boolean(entry[1]),
    ),
  );

  if (options.collect !== false && typeof fetch === "function") {
    try {
      await fetch("/collect", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          event,
          event_id: eventId,
          props: Object.keys(props).length > 0 ? props : undefined,
        }),
        keepalive: true,
      });
    } catch {
      // Conversion pixels still fire if the first-party collector is unreachable.
    }
  }

  fireGoogleConversion(event, eventId);
  fireChatgptPixel(event, eventId);
  return eventId;
}
