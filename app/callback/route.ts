import { getDb } from "@/db";
import { D1IdentityStore } from "@/db/identity-store";
import { mutableRedirect } from "@/lib/http-response";
import { handleAuth } from "@workos-inc/authkit-nextjs";

export const GET = handleAuth({
  returnPathname: "/dashboard",
  onSuccess: async ({ user }) => {
    await new D1IdentityStore(getDb()).upsertWorkosUser(user);
  },
  // Response.redirect() has immutable headers in the Workers runtime. AuthKit
  // adds cache-prevention headers after this callback, so return a constructor
  // response whose header guard remains mutable.
  onError: ({ request }) =>
    mutableRedirect(new URL("/auth/error", request.url), 303),
});
