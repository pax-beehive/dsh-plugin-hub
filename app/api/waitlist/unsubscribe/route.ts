import { getDb } from "@/db";
import { createUnsubscribeHandler } from "@/lib/waitlist-unsubscribe";

export async function POST(request: Request) {
  return createUnsubscribeHandler({ getDatabase: getDb })(request);
}
