import { z } from "zod";

const categoryItemSchema = z
  .object({
    name: z.string(),
    count: z.number().int().nonnegative(),
    displayName: z.string().optional(),
    displayNameZh: z.string().optional(),
    description: z.string().optional(),
    descriptionZh: z.string().optional(),
  })
  .passthrough();

const categoryCountSchema = z
  .object({
    items: z.array(categoryItemSchema),
  })
  .strict();

export type CategoryCount = z.infer<typeof categoryItemSchema>;

// Live /api/v1/categories items include display/description fields the
// older {name,count}.strict() schema rejected, which silently emptied
// /categories. Keep name+count required and accept the extra strings.
export function parseCategoryCountResponse(payload: unknown): CategoryCount[] {
  return categoryCountSchema.parse(payload).items;
}
