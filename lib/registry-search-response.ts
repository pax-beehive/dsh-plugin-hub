import { pluginRecordSchema } from "@dsh-plugin-hub/schemas";
import { z } from "zod";
import type { PluginSummary } from "./registry-service";

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
export function parseRegistrySearchResponse(payload: unknown): {
  items: PluginSummary[];
  nextCursor: string | null;
  total?: number;
} {
  const envelope = registrySearchEnvelopeSchema.parse(payload);
  let quarantined = false;
  const items = envelope.items.flatMap((item) => {
    const parsed = pluginSummarySchema.safeParse(item);
    if (parsed.success) return [parsed.data];
    quarantined = true;
    return [];
  });

  return {
    items,
    nextCursor: envelope.nextCursor,
    ...(quarantined || envelope.total === undefined ? {} : { total: envelope.total }),
  };
}
