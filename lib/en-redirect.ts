import {
  ATTRIBUTION_COOKIE,
  attributionSetCookie,
  captureAttribution,
  canonicalHomeLocation,
  parseAttributionCookie,
  readCookieValue,
} from "./attribution.ts";
import { HUB_LOCALE_COOKIE } from "./i18n.ts";

export function englishHomeRedirect(request: Request): Response {
  const headers = new Headers({
    location: canonicalHomeLocation(request.url),
  });
  headers.append(
    "set-cookie",
    `${HUB_LOCALE_COOKIE}=en; Path=/; Max-Age=31536000; SameSite=Lax`,
  );

  const existing = readCookieValue(request.headers.get("cookie"), ATTRIBUTION_COOKIE);
  if (!parseAttributionCookie(existing)) {
    headers.append(
      "set-cookie",
      attributionSetCookie(
        captureAttribution({
          url: request.url,
          referrer: request.headers.get("referer"),
        }),
        { secure: new URL(request.url).protocol === "https:" },
      ),
    );
  }

  return new Response(null, { status: 308, headers });
}
