import { upsertHubWorkosUser } from "@/lib/hub-internal";
import { mutableRedirect } from "@/lib/http-response";
import { handleAuth } from "@workos-inc/authkit-nextjs";

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
  },
  // Response.redirect() has immutable headers in the Workers runtime. AuthKit
  // adds cache-prevention headers after this callback, so return a constructor
  // response whose header guard remains mutable.
  onError: ({ request }) =>
    mutableRedirect(new URL("/auth/error", request.url), 303),
});
