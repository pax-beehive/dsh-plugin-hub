import { getDb } from "@/db";
import { D1RegistryStore } from "@/db/registry-store";
import { createPackageSearchHandler } from "@/lib/registry-service";

export async function GET(request: Request) {
  return createPackageSearchHandler(new D1RegistryStore(getDb()))(request);
}
