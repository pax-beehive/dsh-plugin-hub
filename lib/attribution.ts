export const ATTRIBUTION_COOKIE = "dsh-hub-attribution";
export const SIGNUP_EVENT_COOKIE = "dsh-hub-signup-event";
export const ATTRIBUTION_MAX_AGE = 90 * 24 * 60 * 60;
export const SIGNUP_EVENT_MAX_AGE = 10 * 60;

export const ATTRIBUTION_QUERY_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "gclid",
  "wbraid",
  "gbraid",
  "oppref",
] as const;

export const ATTRIBUTION_KEYS = [
  ...ATTRIBUTION_QUERY_KEYS,
  "landing_path",
  "referrer",
] as const;

export type AttributionKey = (typeof ATTRIBUTION_KEYS)[number];
export type Attribution = Partial<Record<AttributionKey, string>>;


function bounded(value: string, maxLength: number): string {
  return value.trim().slice(0, maxLength);
}

export function shortReferrer(referrer: string | null | undefined): string | undefined {
  if (!referrer) return undefined;
  const trimmed = referrer.trim();
  if (!trimmed) return undefined;
  try {
    return new URL(trimmed).host.slice(0, 200);
  } catch {
    return trimmed.slice(0, 200);
  }
}

export function parseAttributionSearch(
  search: string | URLSearchParams,
): Attribution {
  const params =
    typeof search === "string"
      ? new URLSearchParams(search.startsWith("?") ? search.slice(1) : search)
      : search;
  const attribution: Attribution = {};
  for (const key of ATTRIBUTION_KEYS) {
    const value = params.get(key);
    if (value) attribution[key] = bounded(value, key === "landing_path" ? 500 : 200);
  }
  return attribution;
}

export function captureAttribution(input: {
  url: string | URL;
  referrer?: string | null;
}): Attribution {
  const url =
    typeof input.url === "string" ? new URL(input.url, "http://localhost") : input.url;
  const attribution = parseAttributionSearch(url.searchParams);
  attribution.landing_path = `${url.pathname}${url.search}`.slice(0, 500);
  const referrer = shortReferrer(input.referrer);
  if (referrer) attribution.referrer = referrer;
  return attribution;
}

export function serializeAttribution(attribution: Attribution): string {
  const params = new URLSearchParams();
  for (const key of ATTRIBUTION_KEYS) {
    const value = attribution[key];
    if (value) params.set(key, value);
  }
  return params.toString();
}

export function parseAttributionCookie(
  value: string | null | undefined,
): Attribution | null {
  if (!value) return null;
  try {
    const parsed = parseAttributionSearch(decodeURIComponent(value));
    return Object.keys(parsed).length > 0 ? parsed : null;
  } catch {
    return null;
  }
}

export function readCookieValue(
  cookieHeader: string | null | undefined,
  name: string,
): string | undefined {
  if (!cookieHeader) return undefined;
  for (const part of cookieHeader.split(";")) {
    const trimmed = part.trim();
    if (trimmed.startsWith(`${name}=`)) {
      return trimmed.slice(name.length + 1);
    }
  }
  return undefined;
}

export function readAttributionFromCookieHeader(
  cookieHeader: string | null | undefined,
): Attribution | null {
  return parseAttributionCookie(readCookieValue(cookieHeader, ATTRIBUTION_COOKIE));
}

export function firstTouchAttribution(
  existingCookie: string | null | undefined,
  incoming: Attribution,
): Attribution | null {
  if (parseAttributionCookie(existingCookie)) return null;
  return incoming;
}

export function attributionSetCookie(
  attribution: Attribution,
  options?: { secure?: boolean },
): string {
  const parts = [
    `${ATTRIBUTION_COOKIE}=${encodeURIComponent(serializeAttribution(attribution))}`,
    "Path=/",
    `Max-Age=${ATTRIBUTION_MAX_AGE}`,
    "SameSite=Lax",
  ];
  if (options?.secure) parts.push("Secure");
  return parts.join("; ");
}

export function canonicalHomeLocation(requestUrl: string): string {
  const url = new URL(requestUrl);
  const destination = new URL("/", requestUrl);
  destination.search = url.search;
  if (url.hash) destination.hash = url.hash;
  return destination.toString();
}

/** First-paint IIFE so a click-id landing is stored before React hydrates. */
export function attributionBootstrapScript(): string {
  const keys = JSON.stringify(ATTRIBUTION_QUERY_KEYS);
  return `(function(){try{if(document.cookie.split(";").some(function(p){return p.trim().indexOf("${ATTRIBUTION_COOKIE}=")==0}))return;var p=new URLSearchParams(location.search);var o=new URLSearchParams();${keys}.forEach(function(k){var v=p.get(k);if(v)o.set(k,v.slice(0,200))});o.set("landing_path",(location.pathname+location.search).slice(0,500));if(document.referrer){try{o.set("referrer",new URL(document.referrer).host.slice(0,200))}catch(e){}}var s=location.protocol==="https:"?"; Secure":"";document.cookie="${ATTRIBUTION_COOKIE}="+encodeURIComponent(o.toString())+"; Path=/; Max-Age=${ATTRIBUTION_MAX_AGE}; SameSite=Lax"+s}catch(e){}})();`;
}
