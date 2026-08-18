import { getDb } from "@/db";
import { D1RegistryStore } from "@/db/registry-store";
import { createProfileSearchHandler } from "@/lib/registry-service";

export async function GET(request: Request) {
  return createProfileSearchHandler(new D1RegistryStore(getDb()))(request);
}
