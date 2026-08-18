import { waitlistSignups } from "../db/schema.ts";
import * as schema from "../db/schema.ts";
import { eq, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";

type UnsubscribeDependencies = {
  getDatabase(): DrizzleD1Database<typeof schema>;
};

export function createUnsubscribeHandler(dependencies: UnsubscribeDependencies) {
  return async function handleUnsubscribe(request: Request) {
    const url = new URL(request.url);
    const token = url.searchParams.get("token")?.trim();

    if (!token || token.length > 128) {
      return respond(request, url, "invalid", 400);
    }

    try {
      const rows = await dependencies
        .getDatabase()
        .update(waitlistSignups)
        .set({
          unsubscribedAt: sql`COALESCE(${waitlistSignups.unsubscribedAt}, CURRENT_TIMESTAMP)`,
        })
        .where(eq(waitlistSignups.unsubscribeToken, token))
        .returning({ id: waitlistSignups.id });

      const status = rows.length > 0 ? "done" : "invalid";
      return respond(request, url, status, rows.length > 0 ? 200 : 404);
    } catch (error) {
      console.error("waitlist_unsubscribe_failed", error);
      return respond(request, url, "error", 503);
    }
  };
}

function respond(
  request: Request,
  requestUrl: URL,
  status: "done" | "error" | "invalid",
  statusCode: number,
) {
  const contentType = request.headers.get("content-type") ?? "";
  const acceptsHtml = request.headers.get("accept")?.includes("text/html");

  if (contentType.includes("application/x-www-form-urlencoded") || acceptsHtml) {
    const redirectUrl = new URL("/unsubscribe", requestUrl.origin);
    redirectUrl.searchParams.set("status", status);
    return Response.redirect(redirectUrl, 303);
  }

  return Response.json({ status }, { status: statusCode });
}
