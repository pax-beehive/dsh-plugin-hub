import { getDb } from "@/db";
import { createWaitlistStatsHandler } from "@/lib/waitlist-admin";
import { env } from "cloudflare:workers";

type RuntimeAdminEnv = {
  WAITLIST_ADMIN_TOKEN?: string;
};

export async function GET(request: Request) {
  const runtime = env as unknown as RuntimeAdminEnv;
  return createWaitlistStatsHandler({
    adminSecret: runtime.WAITLIST_ADMIN_TOKEN,
    getDatabase: getDb,
  })(request);
}
