import { getDb } from "@/db";
import { D1IdentityStore } from "@/db/identity-store";
import { D1PublicationStore, PublicationStoreError } from "@/db/publication-store";
import { GitHubPublicationError, publishGitHubRepository } from "@/lib/github-publication";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { env } from "cloudflare:workers";
import { z } from "zod";

const requestSchema = z.object({
  repository: z.string().regex(/^[^/\s]+\/[^/\s]+$/),
}).strict();

type PublicationEnv = {
  GITHUB_APP_ID?: string;
  GITHUB_PRIVATE_KEY?: string;
};

export async function POST(request: Request) {
  const { user } = await withAuth({ ensureSignedIn: true });
  const runtime = env as unknown as PublicationEnv;
  const appId = Number(runtime.GITHUB_APP_ID);
  if (!Number.isSafeInteger(appId) || !runtime.GITHUB_PRIVATE_KEY) {
    return Response.json({ error: "github_app_not_configured" }, { status: 503 });
  }
  try {
    const body = requestSchema.parse(await request.json());
    const db = getDb();
    const result = await publishGitHubRepository({
      workosUserId: user.id,
      repository: body.repository,
      appId,
      privateKey: runtime.GITHUB_PRIVATE_KEY,
      identityStore: new D1IdentityStore(db),
      publicationStore: new D1PublicationStore(db),
    });
    return Response.json(result, { status: result.created ? 201 : 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: "invalid_publication_manifest", issues: error.issues }, { status: 400 });
    }
    if (error instanceof GitHubPublicationError || error instanceof PublicationStoreError) {
      const status = error.code.includes("owned_by_another") ? 409 : 400;
      return Response.json({ error: error.code }, { status });
    }
    return Response.json({ error: "publication_failed" }, { status: 500 });
  }
}
