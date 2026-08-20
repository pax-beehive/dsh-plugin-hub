import { getDb } from "@/db";
import { D1AbuseReportStore } from "@/db/abuse-report-store";
import { createAbuseReportHandler } from "@/lib/abuse-report-service";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { env } from "cloudflare:workers";

type RuntimeReportEnv = {
  TURNSTILE_SECRET_KEY?: string;
  WAITLIST_RATE_LIMIT_SALT?: string;
  WAITLIST_INTEGRATION_TEST?: string;
};

const TURNSTILE_ALWAYS_PASS_TEST_SECRET =
  "1x0000000000000000000000000000000AA";

export async function POST(request: Request) {
  const runtime = env as unknown as RuntimeReportEnv;
  const turnstileSecret = runtime.TURNSTILE_SECRET_KEY;
  const rateLimitSalt = runtime.WAITLIST_RATE_LIMIT_SALT;

  if (!turnstileSecret || !rateLimitSalt) {
    console.error("report_security_not_configured");
    return Response.json({ error: "service_unavailable" }, { status: 503 });
  }

  const expectedHostname = new URL(request.url).hostname;
  const usesOfficialTurnstileTestKey =
    runtime.WAITLIST_INTEGRATION_TEST === "true" &&
    turnstileSecret === TURNSTILE_ALWAYS_PASS_TEST_SECRET;
  const handler = createAbuseReportHandler({
    store: new D1AbuseReportStore(getDb()),
    rateLimitSalt,
    verifyTurnstile: ({ token, remoteIp }) =>
      verifyTurnstileToken({
        secret: turnstileSecret,
        token,
        remoteIp,
        expectedAction: usesOfficialTurnstileTestKey ? null : "report",
        expectedHostnames: usesOfficialTurnstileTestKey
          ? ["example.com"]
          : [expectedHostname],
      }),
  });

  try {
    return await handler(request);
  } catch (error) {
    console.error("report_request_failed", error);
    return Response.json({ error: "storage_unavailable" }, { status: 503 });
  }
}
