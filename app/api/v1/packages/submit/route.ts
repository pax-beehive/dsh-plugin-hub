import { getDb } from "@/db";
import { D1NpmSyncStore } from "@/db/npm-sync-store";
import { D1WaitlistStore } from "@/db/waitlist-store";
import type { NpmSyncQueueMessage } from "@/lib/npm-sync";
import { npmPackageNameSchema } from "@dsh-plugin-hub/schemas";
import { env } from "cloudflare:workers";
import { z } from "zod";

const requestSchema = z.object({
  packageName: z.string().trim().pipe(npmPackageNameSchema),
}).strict();

type SubmissionEnv = {
  NPM_SYNC_QUEUE?: Queue<NpmSyncQueueMessage>;
  NPM_SYNC_RATE_LIMIT_SALT?: string;
  WAITLIST_RATE_LIMIT_SALT?: string;
};

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return Response.json({ error: "invalid_origin" }, { status: 403 });
  }
  const runtime = env as unknown as SubmissionEnv;
  const salt = runtime.NPM_SYNC_RATE_LIMIT_SALT ?? runtime.WAITLIST_RATE_LIMIT_SALT;
  if (!runtime.NPM_SYNC_QUEUE) {
    return Response.json({ error: "sync_queue_unavailable" }, { status: 503 });
  }
  if (!salt) {
    return Response.json({ error: "sync_rate_limit_unavailable" }, { status: 503 });
  }
  try {
    const body = requestSchema.parse(await request.json());
    const remoteIp = request.headers.get("cf-connecting-ip") ?? "unknown";
    const rateKey = await hashRateLimitKey(`npm-sync:${remoteIp}`, salt);
    const db = getDb();
    const rateLimit = await new D1WaitlistStore(db).consumeRateLimit(rateKey);
    if (!rateLimit.allowed) {
      return Response.json(
        { error: "rate_limited" },
        {
          status: 429,
          headers: { "retry-after": String(rateLimit.retryAfterSeconds) },
        },
      );
    }
    await new D1NpmSyncStore(db).recordCandidate(body.packageName, "manual");
    await runtime.NPM_SYNC_QUEUE.send({
      type: "sync-package",
      packageName: body.packageName,
      trigger: "discovery",
    });
    return Response.json({ status: "queued", packageName: body.packageName }, { status: 202 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: "invalid_submission", issues: error.issues },
        { status: 400 },
      );
    }
    return Response.json({ error: "submission_failed" }, { status: 500 });
  }
}

function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

async function hashRateLimitKey(value: string, salt: string) {
  const bytes = new TextEncoder().encode(`${salt}:${value}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
