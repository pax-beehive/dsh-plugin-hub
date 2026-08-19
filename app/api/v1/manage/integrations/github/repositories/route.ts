import { getDb } from "@/db";
import { D1IdentityStore } from "@/db/identity-store";
import { withAuth } from "@workos-inc/authkit-nextjs";

export async function GET() {
  const { user } = await withAuth({ ensureSignedIn: true });
  const repositories = await new D1IdentityStore(getDb()).listGitHubRepositories(
    user.id,
  );
  return Response.json(repositories);
}
