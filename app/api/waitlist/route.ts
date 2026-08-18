import { getDb } from "@/db";
import { D1WaitlistStore } from "@/db/waitlist-store";
import { sendWelcomeEmail } from "@/lib/waitlist-email";
import { createWaitlistHandler } from "@/lib/waitlist-service";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { env, waitUntil } from "cloudflare:workers";

type RuntimeWaitlistEnv = {
  TURNSTILE_SECRET_KEY?: string;
  WAITLIST_RATE_LIMIT_SALT?: string;
};

export async function POST(request: Request) {
  const runtime = env as unknown as RuntimeWaitlistEnv;
  const turnstileSecret = runtime.TURNSTILE_SECRET_KEY;
  const rateLimitSalt = runtime.WAITLIST_RATE_LIMIT_SALT;

  if (!turnstileSecret || !rateLimitSalt) {
    console.error("waitlist_security_not_configured");
    return Response.json({ error: "service_unavailable" }, { status: 503 });
  }

  const expectedHostname = new URL(request.url).hostname;
  const handler = createWaitlistHandler({
    store: new D1WaitlistStore(getDb()),
    rateLimitSalt,
    verifyTurnstile: ({ token, remoteIp }) =>
      verifyTurnstileToken({
        secret: turnstileSecret,
        token,
        remoteIp,
        expectedAction: "waitlist",
        expectedHostnames: [expectedHostname],
      }),
    sendWelcomeEmail,
    defer: (promise) =>
      waitUntil(
        promise.catch((error) => {
          console.error("waitlist_followup_background_failed", error);
        }),
      ),
    sleep: (milliseconds) =>
      new Promise((resolve) => setTimeout(resolve, milliseconds)),
  });

  try {
    return await handler(request);
  } catch (error) {
    console.error("waitlist_request_failed", error);
    return Response.json({ error: "storage_unavailable" }, { status: 503 });
  }
}
