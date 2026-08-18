import { getDb } from "@/db";
import { D1PublisherStore, PublisherStoreError } from "@/db/publisher-store";
import { publisherMetadataSchema, screenshotSchema } from "@dsh-plugin-hub/schemas";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { z } from "zod";

const updateSchema = z.object({
  displayName: z.string().trim().min(1).max(120),
  summary: z.string().trim().min(1).max(300),
  description: z.string().max(20_000),
  homepage: z.union([z.literal(""), z.url().refine((url) => url.startsWith("https://"))]),
  categories: z.array(z.string().trim().min(1).max(60)).max(12),
  keywords: z.array(z.string().trim().min(1).max(60)).max(30),
  screenshots: z.array(screenshotSchema).max(8),
  publisherMetadata: publisherMetadataSchema,
}).strict();

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { user } = await withAuth({ ensureSignedIn: true });
  try {
    const input = updateSchema.parse(await request.json());
    const result = await new D1PublisherStore(getDb()).updateOwnedPlugin(
      user.id,
      (await params).slug,
      {
        ...input,
        homepage: input.homepage || undefined,
      },
    );
    return Response.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: "invalid_listing", issues: error.issues },
        { status: 400 },
      );
    }
    if (error instanceof PublisherStoreError) {
      return Response.json({ error: error.code }, { status: 403 });
    }
    return Response.json({ error: "listing_update_failed" }, { status: 500 });
  }
}
