import { getDb } from "@/db";
import { D1PublicationStore, PublicationStoreError } from "@/db/publication-store";
import { NpmPublicationError, publishNpmPackage } from "@/lib/npm-publication";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { z } from "zod";

const requestSchema = z.object({
  packageName: z.string().min(1).max(214),
  version: z.string().min(1).max(80).optional(),
}).strict();

export async function POST(request: Request) {
  const { user } = await withAuth({ ensureSignedIn: true });
  try {
    const body = requestSchema.parse(await request.json());
    const result = await publishNpmPackage({
      workosUserId: user.id,
      packageName: body.packageName,
      version: body.version,
      publisherName: user.name ?? user.email,
      publicationStore: new D1PublicationStore(getDb()),
    });
    return Response.json(result, { status: result.created ? 201 : 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: "invalid_publication_request", issues: error.issues },
        { status: 400 },
      );
    }
    if (error instanceof NpmPublicationError || error instanceof PublicationStoreError) {
      const status = error.code === "package_not_found"
        ? 404
        : error.code.includes("owned_by_another") || error.code === "slug_taken"
          ? 409
          : error.code === "npm_registry_unavailable"
            ? 502
            : 400;
      return Response.json({ error: error.code }, { status });
    }
    return Response.json({ error: "publication_failed" }, { status: 500 });
  }
}
