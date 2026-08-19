import { getDb } from "@/db";
import { D1RegistryStore } from "@/db/registry-store";
import { createPackageResolveHandler } from "@/lib/registry-service";

export async function GET(request: Request) {
  return createPackageResolveHandler(new D1RegistryStore(getDb()))(request);
}
