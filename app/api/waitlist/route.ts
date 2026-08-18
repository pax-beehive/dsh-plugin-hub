import { getDb } from "@/db";
import { D1WaitlistStore } from "@/db/waitlist-store";
import { sendWelcomeEmail } from "@/lib/waitlist-email";
import { createWaitlistHandler } from "@/lib/waitlist-service";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { env, waitUntil } from "cloudflare:workers";

type RuntimeWaitlistEnv = {
  TURNSTILE_SECRET_KEY?: string;
  WAITLIST_RATE_LIMIT_SALT?: string;
  WAITLIST_INTEGRATION_TEST?: string;
};

const TURNSTILE_ALWAYS_PASS_TEST_SECRET =
  "1x0000000000000000000000000000000AA";

export async function POST(request: Request) {
  const runtime = env as unknown as RuntimeWaitlistEnv;
  const turnstileSecret = runtime.TURNSTILE_SECRET_KEY;
  const rateLimitSalt = runtime.WAITLIST_RATE_LIMIT_SALT;

  if (!turnstileSecret || !rateLimitSalt) {
    console.error("waitlist_security_not_configured");
    return Response.json({ error: "service_unavailable" }, { status: 503 });
  }

  const expectedHostname = new URL(request.url).hostname;
  const usesOfficialTurnstileTestKey =
    runtime.WAITLIST_INTEGRATION_TEST === "true" &&
    turnstileSecret === TURNSTILE_ALWAYS_PASS_TEST_SECRET;
  const handler = createWaitlistHandler({
    store: new D1WaitlistStore(getDb()),
    rateLimitSalt,
    verifyTurnstile: ({ token, remoteIp }) =>
      verifyTurnstileToken({
        secret: turnstileSecret,
        token,
        remoteIp,
        // Cloudflare's server-side test response omits action and reports the
        // synthetic hostname example.com. This branch is doubly gated by an
        // explicit integration-test flag and the published test-only secret.
        expectedAction: usesOfficialTurnstileTestKey ? null : "waitlist",
        expectedHostnames: usesOfficialTurnstileTestKey
          ? ["example.com"]
          : [expectedHostname],
      }),
    sendWelcomeEmail,
    defer: (promise) =>
      waitUntil(
        promise.catch((error) => {
          console.error("waitlist_followup_background_failed", error);
        }),
      ),
  });

  try {
    return await handler(request);
  } catch (error) {
    console.error("waitlist_request_failed", error);
    return Response.json({ error: "storage_unavailable" }, { status: 503 });
  }
}
