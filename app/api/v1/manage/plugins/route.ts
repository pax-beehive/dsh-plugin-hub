import { getDb } from "@/db";
import { D1PublisherStore } from "@/db/publisher-store";
import { withAuth } from "@workos-inc/authkit-nextjs";

export async function GET() {
  const { user } = await withAuth({ ensureSignedIn: true });
  const plugins = await new D1PublisherStore(getDb()).listOwnedPlugins(user.id);
  return Response.json(plugins);
}
