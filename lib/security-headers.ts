import { applyCacheHeaders } from "./cache-control.ts";

export function withSecurityHeaders(response: Response, request?: Request) {
  const headers = new Headers(response.headers);
  headers.set(
    "content-security-policy",
    [
      "default-src 'self'",
      "base-uri 'self'",
      "connect-src 'self' https://challenges.cloudflare.com https://www.google-analytics.com https://www.googleadservices.com https://www.googletagmanager.com https://bzr.openai.com https://bzrcdn.openai.com",
      "font-src 'self' data:",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "frame-src https://challenges.cloudflare.com",
      "img-src 'self' data: https://www.gravatar.com https://www.google-analytics.com https://www.googleadservices.com https://www.googletagmanager.com https://bzr.openai.com https://www.google.com",
      "object-src 'none'",
      "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://www.googletagmanager.com https://www.google-analytics.com https://bzrcdn.openai.com",
      "style-src 'self' 'unsafe-inline'",
      "upgrade-insecure-requests",
    ].join("; "),
  );
  headers.set("permissions-policy", "camera=(), microphone=(), geolocation=()");
  headers.set("referrer-policy", "strict-origin-when-cross-origin");
  headers.set("x-content-type-options", "nosniff");
  headers.set("x-frame-options", "DENY");
  if (request) {
    applyCacheHeaders(headers, request);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
