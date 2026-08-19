import { getDb } from "@/db";
import { D1NpmSyncStore } from "@/db/npm-sync-store";
import { D1PublicationStore } from "@/db/publication-store";
import { NpmSyncError, syncNpmPackage } from "@/lib/npm-sync";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { z } from "zod";

const requestSchema = z.object({
  packageName: z.string().min(1).max(214),
}).strict();

export async function POST(request: Request) {
  await withAuth({ ensureSignedIn: true });
  try {
    const body = requestSchema.parse(await request.json());
    const db = getDb();
    const result = await syncNpmPackage({
      packageName: body.packageName,
      source: "manual",
      syncStore: new D1NpmSyncStore(db),
      publicationStore: new D1PublicationStore(db),
    });
    return Response.json(result, {
      status: result.status === "accepted" ? 200 : 422,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: "invalid_sync_request", issues: error.issues },
        { status: 400 },
      );
    }
    if (error instanceof NpmSyncError) {
      return Response.json({ error: error.code }, { status: 502 });
    }
    return Response.json({ error: "npm_sync_failed" }, { status: 500 });
  }
}
