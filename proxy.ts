import { authkitProxy } from "@workos-inc/authkit-nextjs";
import type { NextFetchEvent, NextRequest } from "next/server";

export default function proxy(request: NextRequest, event: NextFetchEvent) {
  const redirectUri = new URL("/callback", request.url).toString();
  const pathname = request.nextUrl.pathname;
  const protectedPath =
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/") ||
    pathname.startsWith("/integrations/") ||
    pathname.startsWith("/api/v1/manage/");
  return authkitProxy({
    redirectUri,
    middlewareAuth: {
      enabled: protectedPath,
      unauthenticatedPaths: [],
    },
  })(request, event);
}

export const config = {
  matcher: [
    "/",
    "/en",
    "/privacy",
    "/auth/:path*",
    "/plugins/:path*",
    "/profiles/:path*",
    "/sign-in",
    "/sign-out",
    "/callback",
    "/dashboard/:path*",
    "/integrations/:path*",
    "/api/v1/manage/:path*",
  ],
};
