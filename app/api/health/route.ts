import { getDb } from "@/db";
import { createHealthHandler } from "@/lib/waitlist-health";

export async function GET() {
  return createHealthHandler({ getDatabase: getDb })();
}
