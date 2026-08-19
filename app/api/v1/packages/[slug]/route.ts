import { getDb } from "@/db";
import { D1RegistryStore } from "@/db/registry-store";
import { createPackageBySlugHandler } from "@/lib/registry-service";

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  return createPackageBySlugHandler(new D1RegistryStore(getDb()))(slug);
}
