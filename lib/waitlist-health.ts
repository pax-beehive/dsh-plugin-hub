import * as schema from "../db/schema.ts";
import { sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";

type HealthDependencies = {
  getDatabase(): DrizzleD1Database<typeof schema>;
};

const headers = {
  "cache-control": "no-store",
  "content-type": "application/json; charset=utf-8",
};

export function createHealthHandler(dependencies: HealthDependencies) {
  return async function handleHealth() {
    try {
      await dependencies
        .getDatabase()
        .get<{ ok: number }>(sql`SELECT 1 AS ok`);
      return Response.json(
        { status: "ok", database: "reachable" },
        { headers },
      );
    } catch (error) {
      console.error(
        JSON.stringify({
          event: "waitlist_health_failed",
          message:
            error instanceof Error ? error.message.slice(0, 200) : "unknown_error",
        }),
      );
      return Response.json(
        { status: "degraded", database: "unreachable" },
        { status: 503, headers },
      );
    }
  };
}
