import { readAdsEnv } from "@/lib/ads-env";
import {
  ATTRIBUTION_COOKIE,
  SIGNUP_EVENT_COOKIE,
  SIGNUP_EVENT_MAX_AGE,
  parseAttributionCookie,
} from "@/lib/attribution";
import {
  hashEmailSha256,
  recordConversion,
  resolveChatgptCapiConfig,
  shouldHashEmailForMatching,
} from "@/lib/collect";
import { upsertHubWorkosUser } from "@/lib/hub-internal";
import { mutableRedirect } from "@/lib/http-response";
import { handleAuth } from "@workos-inc/authkit-nextjs";
import { cookies, headers } from "next/headers";

async function emitSignInSuccess(email: string): Promise<void> {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const env = readAdsEnv();
  const eventId = crypto.randomUUID();
  const emailSha256 = shouldHashEmailForMatching(env)
    ? await hashEmailSha256(email)
    : undefined;

  await recordConversion({
    event: "sign_in_success",
    eventId,
    attribution: parseAttributionCookie(cookieStore.get(ATTRIBUTION_COOKIE)?.value),
    sourceUrl: "https://dshpluginhub.ai/dashboard",
    userAgent: headerStore.get("user-agent") ?? undefined,
    ipAddress:
      headerStore.get("cf-connecting-ip") ??
      headerStore.get("x-forwarded-for")?.split(",")[0]?.trim(),
    emailSha256,
    chatgpt: resolveChatgptCapiConfig(env),
  });

  const proto = headerStore.get("x-forwarded-proto") ?? "https";
  try {
    cookieStore.set({
      name: SIGNUP_EVENT_COOKIE,
      value: eventId,
      path: "/",
      maxAge: SIGNUP_EVENT_MAX_AGE,
      sameSite: "lax",
      secure: proto === "https",
      httpOnly: false,
    });
  } catch {
    // Client gtag/oaiq on /dashboard is best-effort; CAPI already recorded.
  }
}

export const GET = handleAuth({
  returnPathname: "/dashboard",
  onSuccess: async ({ user }) => {
    // Throws on failure, which handleAuth catches and routes to onError —
    // same behavior as the previous D1 write.
    await upsertHubWorkosUser({
      workosUserId: user.id,
      email: user.email,
      displayName:
        user.name ??
        ([user.firstName, user.lastName].filter(Boolean).join(" ") || null),
      avatarUrl: user.profilePictureUrl,
    });
    try {
      await emitSignInSuccess(user.email);
    } catch {
      // Attribution must never block a completed sign-in.
    }
  },
  // Response.redirect() has immutable headers in the Workers runtime. AuthKit
  // adds cache-prevention headers after this callback, so return a constructor
  // response whose header guard remains mutable.
  onError: ({ request }) =>
    mutableRedirect(new URL("/auth/error", request.url), 303),
});
