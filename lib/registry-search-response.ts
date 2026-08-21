import {
  pluginRecordSchema,
  type PluginRecord,
} from "@dsh-plugin-hub/schemas";
import { z } from "zod";

export type PluginSummary = Omit<PluginRecord, "versions">;

const pluginSummarySchema = pluginRecordSchema.omit({ versions: true });

const registrySearchEnvelopeSchema = z
  .object({
    items: z.array(z.unknown()),
    nextCursor: z.string().nullable(),
    total: z.number().int().nonnegative().optional(),
  })
  .strict();

// A single malformed catalog record should not turn the whole search page
// into a 500. Keep the response envelope strict, but quarantine bad items.
// A bad card must not hide pagination for 3800 other plugins.
export function parseRegistrySearchResponse(payload: unknown): {
  items: PluginSummary[];
  nextCursor: string | null;
  total?: number;
} {
  const envelope = registrySearchEnvelopeSchema.parse(payload);
  const items = envelope.items.flatMap((item) => {
    const parsed = pluginSummarySchema.safeParse(item);
    if (parsed.success) return [parsed.data];
    return [];
  });

  return {
    items,
    nextCursor: envelope.nextCursor,
    ...(typeof envelope.total === "number" ? { total: envelope.total } : {}),
  };
}
